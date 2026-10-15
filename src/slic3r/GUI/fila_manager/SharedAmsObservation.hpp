#pragma once
#include <nlohmann/json.hpp>
#include <optional>
#include <string>

namespace Slic3r { namespace GUI { namespace SharedAmsObservation {
// Only explicit, current AMS presence/read flags and tray identities are used.
// Unrelated MQTT deltas must never turn retained device fields into a new scan.
inline std::optional<nlohmann::json> from_packet(const std::string& message, const std::string& device)
{
    using json = nlohmann::json;
    const auto packet = json::parse(message, nullptr, false);
    if (!packet.is_object() || !packet.contains("print") || !packet["print"].is_object()) return {};
    const auto& print = packet["print"];
    if (!print.contains("ams") || !print["ams"].is_object()) return {};
    const auto& ams = print["ams"];
    if (!ams.contains("ams") || !ams["ams"].is_array()) return {};
    auto bits = [&](const char* key) -> std::optional<unsigned long> {
        if (!ams.contains(key) || !ams[key].is_string()) return {};
        const auto text = ams[key].get<std::string>();
        if (text.empty() || text.size() > 8 || text.find_first_not_of("0123456789abcdefABCDEF") != std::string::npos) return {};
        try { return std::stoul(text, nullptr, 16); } catch (...) { return {}; }
    };
    const auto present = bits("tray_exist_bits");
    const auto reading = bits("tray_reading_bits");
    const auto done = bits("tray_read_done_bits");
    if (!present || !reading || (ams.contains("tray_read_done_bits") && !done)) return {};
    int matching_units = 0;
    for (const auto& unit : ams["ams"])
        if (unit.is_object() && unit.contains("id") && unit["id"] == "0") ++matching_units;
    if (matching_units != 1) return {};
    for (const auto& unit : ams["ams"]) {
        if (!unit.is_object() || !unit.contains("id") || unit["id"] != "0" || !unit.contains("tray") || !unit["tray"].is_array()) continue;
        json slots = json::array();
        for (int slot = 0; slot < 4; ++slot) {
            json row{{"slot", slot + 1}, {"present", (*present & (1UL << slot)) != 0},
                     {"reading", (*reading & (1UL << slot)) != 0}, {"fresh_identity", false}};
            bool seen = false;
            for (const auto& tray : unit["tray"]) {
                if (!tray.is_object() || !tray.contains("id") || tray["id"] != std::to_string(slot)) continue;
                if (seen) return {};
                seen = true;
                row["fresh_identity"] = tray.contains("tray_uuid") && tray["tray_uuid"].is_string() && tray.contains("tag_uid") && tray["tag_uid"].is_string() && (!done || (*done & (1UL << slot)) != 0);
                for (auto field : {"tray_uuid", "tag_uid", "tray_type", "tray_sub_brands", "tray_color", "tray_weight", "tray_info_idx"}) {
                    if (!tray.contains(field) || !tray[field].is_string()) continue;
                    std::string target = field;
                    if (target == "tray_uuid") target = "uuid";
                    else if (target == "tray_type") target = "material";
                    else if (target == "tray_sub_brands") target = "name";
                    else if (target == "tray_color") target = "color";
                    else if (target == "tray_weight") target = "capacity";
                    else if (target == "tray_info_idx") target = "profile";
                    row[target] = tray[field];
                }
            }
            slots.push_back(std::move(row));
        }
        return json{{"op", "ams_observe"}, {"device_id", device}, {"slots", slots}};
    }
    return {};
}
}}}
