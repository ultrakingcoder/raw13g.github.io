#!/bin/bash
set -e

if [ ! -d "installer" ]; then
    echo "Cloning base ps4-hen template..."
    git clone https://github.com/Scene-Collective/ps4-hen.git temp_hen
    cp -a temp_hen/installer ./installer
    cp -a temp_hen/Makefile ./Makefile 2>/dev/null || true
    rm -rf temp_hen
fi

mkdir -p installer/source
mkdir -p plugins

if [ ! -f "plugins.zip" ]; then
    curl -fLJO https://github.com/Scene-Collective/ps4-hen-plugins/releases/latest/download/plugins.zip
fi

unzip -o plugins.zip -d plugins/ || true
find . -maxdepth 2 -name "*.prx" -exec cp -n {} plugins/ \;

pushd plugins > /dev/null
for file in *.prx; do
    if [ -f "$file" ]; then
        echo "${file}"
        xxd -i "$file" | sed 's/^unsigned /static const unsigned /' > "../installer/source/${file%.prx}_prx.inc.c"
    fi
done
popd > /dev/null

if [ -f "hen.ini" ]; then
    xxd -i "hen.ini" | sed 's/^unsigned /static const unsigned /' > "installer/source/hen.ini.inc.c"
fi

pushd installer > /dev/null
make clean || true
make
popd > /dev/null

cp installer/installer.bin Rev3rseApex.bin
