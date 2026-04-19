#!/bin/sh

## hyphop ##

CMD(){
	echo "$@" >&2
	"$@"
}

for r in 192 512; do
CMD convert a3m.icon.svg -resize ${r}x${r} a3m.icon.$r.png
done


