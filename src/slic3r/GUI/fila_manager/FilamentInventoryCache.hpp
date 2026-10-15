#pragma once
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <set>
#include <stdexcept>

namespace Slic3r { namespace GUI { namespace FilamentInventoryCache {

inline nlohmann::json read(const std::filesystem::path& path)
{
    if (std::filesystem::file_size(path) > 16 * 1024 * 1024)
        throw std::runtime_error("Inventory cache is too large");
    std::ifstream input(path);
    if (!input) throw std::runtime_error("Cannot read inventory cache");
    nlohmann::json data;
    input >> data;
    if (data.value("schema_version", 0) != 1 || !data.contains("spools") || !data["spools"].is_array())
        throw std::runtime_error("Unsupported inventory cache schema");
    std::set<std::string> ids;
    for (const auto& spool : data["spools"]) {
        const auto id = spool.at("spool_id").get<std::string>();
        if (id.empty() || !ids.insert(id).second)
            throw std::runtime_error("Duplicate or empty physical spool identity");
    }
    return data["spools"];
}

inline void write(const std::filesystem::path& path, const nlohmann::json& spools)
{
    // The launcher selects a private, profile-specific path. No account data
    // is copied into the source checkout or logged by this cache.
    auto temporary = path;
    temporary += ".tmp";
    try {
        std::ofstream output(temporary, std::ios::trunc);
        if (!output) throw std::runtime_error("Cannot write inventory cache");
        std::filesystem::permissions(temporary, std::filesystem::perms::owner_read |
            std::filesystem::perms::owner_write, std::filesystem::perm_options::replace);
        output << nlohmann::json{{"schema_version", 1}, {"spools", spools}}.dump(2) << '\n';
        output.flush();
        if (!output) throw std::runtime_error("Inventory cache write failed");
        output.close();
        std::filesystem::rename(temporary, path);
    } catch (...) {
        std::error_code ignored;
        std::filesystem::remove(temporary, ignored);
        throw;
    }
}

}}} // namespaces
