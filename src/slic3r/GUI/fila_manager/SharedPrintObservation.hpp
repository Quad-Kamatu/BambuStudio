#pragma once
#include <nlohmann/json.hpp>
#include <optional>
#include <string>
#include <vector>

namespace Slic3r { namespace GUI { namespace SharedPrintObservation {
// Only a fresh job/state/mapping/feed update drives accounting. Temperature and
// other unrelated deltas must not replay a retained completion state.
inline std::optional<nlohmann::json> from_packet(const std::string& message,
    const std::string& device, const std::string& job_id, const std::string& state,
    const std::string& title, const std::vector<uint16_t>& mapping)
{
    using nlohmann::json;
    const auto packet = json::parse(message, nullptr, false);
    if (!packet.is_object() || !packet.contains("print") || !packet["print"].is_object()) return {};
    const auto& print = packet["print"];
    const bool has_feed = print.contains("ams") && print["ams"].is_object() && print["ams"].contains("tray_now");
    if (!print.contains("job_id") && !print.contains("gcode_state") && !print.contains("mapping") && !has_feed) return {};
    if (state == "IDLE" && (job_id.empty() || job_id == "0") && print.contains("gcode_state") && print["gcode_state"] == "IDLE")
        return json{{"op", "print_idle"}, {"device_id", device}};
    if ((state == "FINISH" || state == "FAILED") && (!print.contains("job_id") || !print.contains("gcode_state"))) return {};
    if (job_id.empty() || job_id == "0" || job_id.size() > 25 || job_id.find_first_not_of("0123456789") != std::string::npos) return {};
    if (state != "RUNNING" && state != "PAUSE" && state != "PREPARE" && state != "FINISH" && state != "FAILED" && state != "IDLE") return {};
    json result{{"op", "print_observe"}, {"device_id", device}, {"job_id", job_id}, {"state", state}, {"title", title}};
    if (!mapping.empty()) result["mapping"] = mapping;
    if (has_feed) {
        const auto& value = print["ams"]["tray_now"];
        if (value.is_number_integer()) result["active_slot"] = value;
        else if (value.is_string()) {
            const auto text = value.get<std::string>();
            if (!text.empty() && text.size() < 5 && text.find_first_not_of("0123456789") == std::string::npos)
                result["active_slot"] = std::stoi(text);
        }
    }
    return result;
}
}}}
