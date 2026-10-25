#!/bin/bash
set -e

# Clone the base template if installer folder doesn't exist
if [ ! -d "installer" ]; then
    echo "Cloning base ps4-hen template..."
    git clone https://github.com/Scene-Collective/ps4-hen.git temp_hen
    cp -r temp_hen/* .
    rm -rf temp_hen
fi

# Ensure required directories exist
mkdir -p installer/source
mkdir -p plugins

# Download plugins package
if [ ! -f "plugins.zip" ]; then
    curl -fLJO https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
fi

# Extract safely
unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

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
