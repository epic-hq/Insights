import type { SimpleMediaPlayerProps } from "./SimpleMediaPlayer"
import { SimpleMediaPlayer } from "./SimpleMediaPlayer"

type MediaPlayerProps = Pick<SimpleMediaPlayerProps, "mediaUrl" | "title" | "className" | "autoPlay" | "showDebug">

export function MediaPlayer(props: MediaPlayerProps) {
	return <SimpleMediaPlayer {...props} />
}
