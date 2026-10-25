#!/bin/bash
set -e

# Clone the base ps4-hen repository if kpayload doesn't exist
if [ ! -d "kpayload" ]; then
    echo "Cloning base ps4-hen template..."
    git clone https://github.com/Scene-Collective/ps4-hen.git temp_hen
    cp -r temp_hen/. .
    rm -rf temp_hen
fi

# Build kernel payload first so kpayload.inc.c is generated
cd kpayload
make clean || true
make
cd ..

mkdir -p installer/source
mkdir -p plugins

if [ ! -f "plugins.zip" ]; then
    curl -fLJO https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
fi

unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

cd plugins
for file in *.prx; do
    if [ -f "$file" ]; then
        echo "${file}"
        xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "../installer/source/${file%.prx}_prx.inc.c"
    fi
done
cd ..

# Process configuration ini if present, otherwise create a valid empty fallback
if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
else
    echo "static const unsigned char hen_ini[] = {};" > "installer/source/hen.ini.inc.c"
    echo "static unsigned int hen_ini_len = 0;" >> "installer/source/hen.ini.inc.c"
fi

cd installer
make clean || true
make
cd ..

cp installer/installer.bin Rev3rseApex.bin
