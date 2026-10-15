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

// A local trusted executable, invoked as argv (never through a shell). All
// request/response files live in a private temporary directory and are removed.
inline nlohmann::json exchange(const nlohmann::json& base, const nlohmann::json& current)
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
        file << nlohmann::json{{"base", base}, {"current", current}};
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
}}}
