#define CATCH_CONFIG_MAIN
#include <catch2/catch.hpp>
#include "slic3r/GUI/fila_manager/FilamentInventoryCache.hpp"

using namespace Slic3r::GUI;
TEST_CASE("Inventory cache preserves separate spool identity and evidence", "[inventory-cache]")
{
    const auto dir = std::filesystem::temp_directory_path() / "bambu-fork-inventory-cache-test";
    std::filesystem::create_directories(dir);
    const auto path = dir / "spools.json";
    const nlohmann::json spools = {{{"spool_id", "physical-1"}, {"net_weight", 432.125}, {"note", "estimated"}},
                                  {{"spool_id", "physical-2"}, {"net_weight", nullptr}, {"material_type", ""}}};
    FilamentInventoryCache::write(path, spools);
    REQUIRE(FilamentInventoryCache::read(path) == spools);
    REQUIRE((std::filesystem::status(path).permissions() & std::filesystem::perms::others_read) == std::filesystem::perms::none);
    SECTION("Duplicate IDs cannot silently merge histories") {
        auto duplicates = spools;
        duplicates.push_back(spools[0]);
        FilamentInventoryCache::write(path, duplicates);
        REQUIRE_THROWS(FilamentInventoryCache::read(path));
    }
    SECTION("Malformed data is rejected") {
        std::ofstream output(path); output << "not JSON"; output.close();
        REQUIRE_THROWS(FilamentInventoryCache::read(path));
    }
    SECTION("Failed write retains the existing cache") {
        std::filesystem::create_directory(path.string() + ".tmp");
        REQUIRE_THROWS(FilamentInventoryCache::write(path, nlohmann::json::array()));
        REQUIRE(FilamentInventoryCache::read(path) == spools);
    }
    std::filesystem::remove_all(dir);
}
