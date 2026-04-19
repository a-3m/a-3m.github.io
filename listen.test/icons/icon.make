#!/bin/sh

## hyphop ##

CMD(){
	echo "$@" >&2
	"$@"
}

for a in *.svg; do
[ -s "$a" ] || exit 1
for r in 192 512; do
n=${a%%.*}
CMD convert "$a" -resize ${r}x${r} "$n-$r".png
done
done

