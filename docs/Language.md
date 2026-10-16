### Our uniform language - core concepts

**CORE DOMAIN:** Party Music Session

**Ubiquitous language**

- _Host_: creator of the sessions, admin
- _Guest_: the users joining the session via the QR-code to add songs
- _Session_: created by the host, is an independent party room
- _SongItem_: the song itself, received from the music provider (spotify) and already verified / already in queue
- _SongRequest_: unverified Song, what comes up in the search and is requested by a guest, has yet to be checked (for ex. for duplicate)
- _QueueEntry_: the entierty of SongItem plus QueuePosition
- _MusicQueue_: the collection of all queue entries, basically the playlist
- _PlaybackStatus_: whether the song is playing, paused, up next etc.
- _SessionRules_: rules defined by the host
- _StaticRules_: rules we define, which are always true; what we define (for ex. no duplicates)
- _QueuePosition_: priority level in the queue
- _ModerationDecision_: all rules which are guidelines of what goes into music queue

**Bounded Contexts**

- _Playback_: responsible for communication with music provider, tracking playback state, and notifying queue management when a song finishes or fails
- _Moderation_: responsible for event rules, evaluating content; supported by AI for decisionmaking
- _QueueManagement_: responsible for queue order, duplicates, removal of songItems, deciding which song is up next
- _UserInteraction_: responsible for creating and closing sessions, generating qr-codes, validating access
