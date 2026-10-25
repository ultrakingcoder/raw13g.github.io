#!/bin/bash
set -e

echo "Setting up repository workspace..."

# Download base template if needed
if [ ! -d "kpayload" ]; then
    curl -fL -o main.zip https://github.com/Scene-Collective/ps4-hen/archive/refs/heads/main.zip
    unzip -o main.zip
    cp -r ps4-hen-main/. .
    rm -rf ps4-hen-main main.zip
fi

# Build kpayload
cd kpayload
make clean || true
make
cd ..

# Prepare directories
mkdir -p installer/source
mkdir -p plugins

# Download and extract plugins
if [ ! -f "plugins.zip" ]; then
    curl -fL -o plugins.zip https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
fi

unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

# Convert plugins to C includes
cd plugins
for file in *.prx; do
    if [ -f "$file" ]; then
        xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "../installer/source/${file%.prx}_prx.inc.c"
    fi
done
cd ..

# Handle configuration
if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
else
    echo "static const unsigned char hen_ini[] = {};" > "installer/source/hen.ini.inc.c"
    echo "static unsigned int hen_ini_len = 0;" >> "installer/source/hen.ini.inc.c"
fi

# Build installer
cd installer
make clean || true
make
cd ..

# Output final binary
cp installer/installer.bin Rev3rseApex.bin
echo "Build completed successfully!"
