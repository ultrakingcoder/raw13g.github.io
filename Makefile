# language: Makefile, file: Makefile, target: Linux/Cross-compile
CC = clang
CFLAGS = -target x86_64-freestanding -ffreestanding -fno-pie -no-pie -fno-stack-protector -c -O2
LDFLAGS = -nostdlib -Wl,-e,_start -Wl,-static -Wl,--oformat,binary

all: custom_hen.bin

custom_hen.bin: src/custom_hen.c
	@mkdir -p build
	$(CC) $(CFLAGS) src/custom_hen.c -o build/custom_hen.o
	$(CC) $(LDFLAGS) build/custom_hen.o -o custom_hen.bin

clean:
	rm -f *.o *.bin
	rm -rf build

.PHONY: all clean
