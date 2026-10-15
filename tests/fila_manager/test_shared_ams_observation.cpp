#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>
#include "slic3r/GUI/fila_manager/SharedAmsObservation.hpp"
using namespace Slic3r::GUI;
TEST_CASE("Only fresh AMS frames become RFID observations", "[shared-ams]")
{
    using nlohmann::json;
    json packet = {{"print", {{"ams", {{"tray_exist_bits", "3"}, {"tray_reading_bits", "2"},
      {"ams", json::array({{{"id", "0"}, {"tray", json::array({{{"id", "0"}, {"tray_uuid", std::string(32, 'A')}, {"tag_uid", "0000000000000100"}, {"tray_type", "PLA"}, {"tray_weight", "1000"}}})}}})}}}}}};
    auto result = SharedAmsObservation::from_packet(packet.dump(), "fixture");
    REQUIRE(result.has_value());
    REQUIRE((*result)["device_id"] == "fixture");
    REQUIRE((*result)["slots"].size() == 4);
    REQUIRE((*result)["slots"][0]["fresh_identity"] == true);
    REQUIRE((*result)["slots"][0]["uuid"] == std::string(32, 'A'));
    REQUIRE((*result)["slots"][1]["reading"] == true);
    REQUIRE((*result)["slots"][2]["present"] == false);
    REQUIRE_FALSE(SharedAmsObservation::from_packet("not JSON", "fixture"));
    REQUIRE_FALSE(SharedAmsObservation::from_packet(R"({"print":{"nozzle_temper":220}})", "fixture"));
    SECTION("Missing fresh flags cannot demount anything") {
        packet["print"]["ams"].erase("tray_exist_bits");
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }
    SECTION("Malformed flags cannot look empty") {
        packet["print"]["ams"]["tray_exist_bits"] = "invalid";
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }
    SECTION("Missing UUID is explicitly partial") {
        packet["print"]["ams"]["ams"][0]["tray"][0].erase("tray_uuid");
        result = SharedAmsObservation::from_packet(packet.dump(), "fixture");
        REQUIRE((*result)["slots"][0]["fresh_identity"] == false);
    }
    SECTION("Other AMS systems cannot rewrite this inventory") {
        packet["print"]["ams"]["ams"][0]["id"] = "1";
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }
    SECTION("Disconnect is not removal") {
        packet["print"]["ams"]["ams"] = json::array();
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }
    SECTION("Conflicting duplicate units and trays are rejected") {
        auto duplicate = packet["print"]["ams"]["ams"][0];
        packet["print"]["ams"]["ams"].push_back(duplicate);
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
        packet["print"]["ams"]["ams"].erase(1);
        auto& trays = packet["print"]["ams"]["ams"][0]["tray"];
        trays.push_back(trays[0]);
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }

    SECTION("An explicit incomplete read cannot publish an identity") {
        packet["print"]["ams"]["tray_read_done_bits"] = "0";
        result = SharedAmsObservation::from_packet(packet.dump(), "fixture");
        REQUIRE((*result)["slots"][0]["fresh_identity"] == false);
    }

    SECTION("Malformed completion flags reject the frame") {
        packet["print"]["ams"]["tray_read_done_bits"] = "invalid";
        REQUIRE_FALSE(SharedAmsObservation::from_packet(packet.dump(), "fixture"));
    }

}
