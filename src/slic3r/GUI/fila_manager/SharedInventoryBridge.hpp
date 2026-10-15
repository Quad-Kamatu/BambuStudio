#pragma once
#include <boost/process.hpp>
#include <boost/filesystem.hpp>
#include <nlohmann/json.hpp>
#include <chrono>
#include <cstdlib>
#include <fstream>
#include <stdexcept>

namespace Slic3r { namespace GUI { namespace SharedInventoryBridge {
inline bool enabled()
{
    const char* helper = std::getenv("BAMBU_FORK_SHARED_INVENTORY");
    return helper && *helper;
}

// Scope passive telemetry even when the inventory tab is open without Device selected.
inline bool device_matches(const std::string& device)
{
    if (!enabled()) return false;
    static const std::string configured = []() -> std::string {
        const char* path = std::getenv("FILAMENT_SHARED_CONFIG");
        if (!path) return {};
        try {
            if (boost::filesystem::file_size(path) > 2000000) return {};
            std::ifstream file(path);
            nlohmann::json config; file >> config;
            return config.at("device").at("dev_id").get<std::string>();
        } catch (...) { return {}; }
    }();
    return !configured.empty() && configured == device;
}

// A local trusted executable, invoked as argv (never through a shell). All
// request/response files live in a private temporary directory and are removed.
inline nlohmann::json request(const nlohmann::json& payload)
{
    namespace bp = boost::process;
    namespace fs = boost::filesystem;
    const char* helper = std::getenv("BAMBU_FORK_SHARED_INVENTORY");
    if (!helper || !fs::path(helper).is_absolute())
        throw std::runtime_error("Shared inventory helper must be an absolute executable path");
    const auto directory = fs::temp_directory_path() / fs::unique_path("studio-inventory-%%%%%%%%-%%%%%%%%");
    fs::create_directory(directory);
    fs::permissions(directory, fs::owner_all);
    struct Cleanup { fs::path path; ~Cleanup() { boost::system::error_code error; fs::remove_all(path, error); } } cleanup{directory};
    auto input = directory / "request.json";
    auto output = directory / "response.json";
    {
        std::ofstream file(input.string());
        file << payload;
        if (!file) throw std::runtime_error("Cannot prepare shared inventory request");
    }
    bp::child worker(helper, input.string(), output.string(), bp::std_out > bp::null, bp::std_err > bp::null);
    if (!worker.wait_for(std::chrono::seconds(5))) {
        worker.terminate(); worker.wait();
        throw std::runtime_error("Shared inventory backend timed out; inventory was not acknowledged");
    }
    if (worker.exit_code() != 0 || !fs::exists(output) || fs::file_size(output) > 2000000)
        throw std::runtime_error("Shared inventory backend unavailable");
    std::ifstream file(output.string());
    nlohmann::json result; file >> result;
    return result;
}
inline nlohmann::json exchange(const nlohmann::json& base, const nlohmann::json& current)
{
    return request({{"base", base}, {"current", current}});
}
}}}
