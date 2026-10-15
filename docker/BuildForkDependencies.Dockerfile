FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf automake build-essential ca-certificates cmake curl extra-cmake-modules \
    file gettext git libtool locales m4 nasm ninja-build patch pkg-config python3 \
    libglu1-mesa-dev libwayland-dev libxkbcommon-dev wayland-protocols \
    eglexternalplatform-dev libglew-dev libgtk-3-dev libdbus-1-dev libcairo2-dev \
    libwebkit2gtk-4.1-dev libsoup-3.0-dev libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev libosmesa6-dev libssl-dev libcurl4-openssl-dev \
    libsecret-1-dev libudev-dev libunwind-dev libfuse2 wget xvfb \
    && rm -rf /var/lib/apt/lists/*
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 CMAKE_BUILD_PARALLEL_LEVEL=12
COPY deps /buildsrc/deps
COPY cmake /buildsrc/cmake
RUN --mount=type=cache,target=/build/deps \
    cmake -S /buildsrc/deps -B /build/deps -G Ninja \
    -DDEP_WX_GTK3=ON -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    > /build/deps/configure.log 2>&1 \
    && (cmake --build /build/deps --parallel 1 > /build/deps/build.log 2>&1 \
        || (tail -120 /build/deps/build.log; exit 1)) \
    && cp -a /build/deps/destdir /destdir
RUN mkdir -p /build/deps && ln -s /destdir /build/deps/destdir
