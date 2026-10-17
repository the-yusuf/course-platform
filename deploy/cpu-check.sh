#!/usr/bin/env bash
# Runs sharp and argon2 inside an API image on an emulated copy of the VPS's CPU
# ("QEMU Virtual CPU version 2.5+": x86-64 without SSE4.1, SSE4.2 or POPCNT), so a
# dependency that needs a newer CPU fails here instead of in production.
# CI runs it on every build; run it yourself after upgrading sharp:
#   docker build -t course-platform-api . && deploy/cpu-check.sh course-platform-api
set -euo pipefail

image="${1:?usage: deploy/cpu-check.sh <image>}"
qemu_dir="$(mktemp -d)"
trap 'rm -rf "$qemu_dir"' EXIT

# Debian 13's qemu-user is a static binary, so it runs inside the node image too.
# Unlike the server's KVM, it refuses every instruction the emulated CPU lacks.
docker run --rm -e DEBIAN_FRONTEND=noninteractive -v "$qemu_dir:/out" debian:trixie-slim sh -c \
  'apt-get update -qq && apt-get install -y -qq --no-install-recommends qemu-user > /dev/null && cp /usr/bin/qemu-x86_64 /out/'

# An illegal instruction makes QEMU write a core dump of the whole emulated process,
# which takes many minutes: no core dumps, and a time limit as a backstop.
docker run --rm --ulimit core=0 --entrypoint timeout -v "$qemu_dir/qemu-x86_64:/qemu:ro" "$image" \
  120 /qemu -cpu qemu64 /usr/local/bin/node --input-type=module -e "
import sharp from 'sharp';
import { hash, verify } from 'argon2';
const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#c00' } }).png().toBuffer();
await sharp(png).resize(32, 32).webp().toBuffer();
if (!(await verify(await hash('cpu-check'), 'cpu-check'))) throw new Error('argon2 verify failed');
console.log('cpu-check: sharp and argon2 work on a qemu64 CPU');
"
