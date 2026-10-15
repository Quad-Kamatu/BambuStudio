#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>
#include "libslic3r/PresetBundle.hpp"
// PresetBundle pulls NSVGUtils from libslic3r. The GUI normally provides
// NanoSVG through BitmapCache; this focused test links its implementation here.
#define NANOSVG_IMPLEMENTATION
#include "nanosvg/nanosvg.h"

using namespace Slic3r;

static void add_filament(PresetBundle& bundle, const std::string& name,
                         const std::string& id, const std::string& setting_id,
                         const std::string& vendor, const std::string& type,
                         const std::string& printer)
{
    DynamicPrintConfig config = bundle.filaments.default_preset().config;
    config.set_key_value("filament_vendor", new ConfigOptionStrings({vendor}));
    config.set_key_value("filament_type", new ConfigOptionStrings({type}));
    config.set_key_value("compatible_printers", new ConfigOptionStrings({printer}));
    config.set_key_value("filament_printable", new ConfigOptionInts({1}));
    Preset& preset = bundle.filaments.load_preset("", name, config, false);
    preset.filament_id = id;
    preset.setting_id = setting_id;
    preset.alias = name.substr(0, name.find(" @"));
    preset.is_system = true;
}

TEST_CASE("Manual spool IDs resolve without changing material or printer", "[filament-spool]")
{
    PresetBundle bundle;
    add_filament(bundle, "Generic PLA @P2S", "GFL99", "GFSL99", "Generic", "PLA", "P2S");
    add_filament(bundle, "Generic PETG @P2S", "GFG99", "GFSG99", "Generic", "PETG", "P2S");
    add_filament(bundle, "Example PLA @P2S", "GFL03", "cloud-setting-03", "Example", "PLA", "P2S");
    add_filament(bundle, "Generic ABS @A1", "GFA99", "GFSA99", "Generic", "ABS", "A1");

    SECTION("Valid original profile remains selected") {
        auto result = bundle.resolve_filament_for_spool("GFL03", "Other", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL03");
    }
    SECTION("Cloud setting ID is resolved to the preset filament ID") {
        auto result = bundle.resolve_filament_for_spool("cloud-setting-03", "Example", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL03");
    }
    SECTION("Uncatalogued brand uses a compatible Generic material") {
        auto result = bundle.resolve_filament_for_spool("", "Uncatalogued", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL99");
    }
    SECTION("Known vendor is retained when compatible") {
        auto result = bundle.resolve_filament_for_spool("broken", "Example", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL03");
    }
    SECTION("Unknown material is not inferred from a brand") {
        REQUIRE_FALSE(bundle.resolve_filament_for_spool("", "Example", "", "P2S"));
    }
    SECTION("Ambiguous vendor formulations use the Generic polymer") {
        add_filament(bundle, "Example PLA Silk @P2S", "GFL04", "cloud-setting-04", "Example", "PLA", "P2S");
        auto result = bundle.resolve_filament_for_spool("", "Example", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL99");
    }
    SECTION("Wrong original polymer falls back to the stated polymer") {
        auto result = bundle.resolve_filament_for_spool("GFG99", "Uncatalogued", "PLA", "P2S");
        REQUIRE(result); REQUIRE(result->filament_id == "GFL99");
    }
    SECTION("Incompatible printer remains unsupported") {
        REQUIRE_FALSE(bundle.resolve_filament_for_spool("GFA99", "Generic", "ABS", "P2S"));
        REQUIRE_FALSE(bundle.resolve_filament_for_spool("", "Other", "PLA", "A1"));
    }
}
