#!/usr/bin/env sh
# تنزيل المصادر المفتوحة (Tanzil عبر quran-api) إلى data/
set -e; mkdir -p data; B=https://raw.githubusercontent.com/fawazahmed0/quran-api/1
curl -sfo data/info.json $B/info.json
for e in ara-quransimple ara-kingfahadquranc ara-sirajtafseer; do curl -sfo data/$e.json $B/editions/$e.json; done
echo "تم تنزيل المصادر"
