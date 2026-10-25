#!/bin/bash
set -e

# Download plugins package
if [ ! -f "plugins.zip" ]; then
    curl -fLJO https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
    unzip -o plugins.zip
fi

# Process plugin files
pushd plugins > /dev/null
for file in *.prx; do
    if [ -f "$file" ]; then
        echo "${file}"
        xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "../installer/source/${file%.prx}_prx.inc.c"
    fi
done
popd > /dev/null

# Process configuration ini if present
if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
fi

# Compile installer
pushd installer > /dev/null
make clean || true
make
popd > /dev/null

# Copy final binary
cp installer/installer.bin hen.bin
