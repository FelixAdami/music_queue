import { useEffect, useRef, useState } from "react";
import { getQueue, removeSong, reorderQueue, type Song } from "../api/client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import "../style/NextSongsList.css";

type Props = {
  roomId: string;
};

type SortableSongProps = {
  song: Song;
  removingId: string | null;
  disabled: boolean;
  onRemove: (songId: string) => void;
};

function SortableSong({
  song,
  removingId,
  disabled,
  onRemove,
}: SortableSongProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: song._id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="queue-song-row">
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="btn btn-sm queue-song-drag-handle"
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
        aria-label={`Move ${song.title}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>

      {song.imageUrl && (
        <img
          className="queue-song-cover"
          src={song.imageUrl}
          alt=""
          width={55}
          height={55}
          style={{ objectFit: "cover" }}
        />
      )}

      <div className="queue-song-info">
        <strong>{song.title}</strong>
        <div className="text-secondary">{song.artist}</div>
      </div>

      <button
        type="button"
        className="btn btn-outline-danger btn-sm queue-song-remove"
        disabled={disabled || isDragging}
        onClick={() => onRemove(song._id)}
      >
        {removingId === song._id ? "Removing..." : "X"}
      </button>
    </div>
  );
}

function NextSongsList({ roomId }: Props) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [reorderError, setReorderError] = useState("");

  const [removingId, setRemovingId] = useState<string | null>(null);

  const [reordering, setReordering] = useState(false);

  const draggingRef = useRef(false);
  const updatingRef = useRef(false);
  const queueVersionRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      if (draggingRef.current || updatingRef.current) {
        return;
      }

      const version = queueVersionRef.current;

      try {
        const data = await getQueue(roomId);

        if (
          active &&
          !draggingRef.current &&
          !updatingRef.current &&
          version === queueVersionRef.current
        ) {
          setSongs(data);
          setError("");
        }
      } catch {
        if (
          active &&
          !updatingRef.current &&
          version === queueVersionRef.current
        ) {
          setError("Could not load the queue.");
        }
      }
    }

    void loadQueue();

    const interval = window.setInterval(() => {
      void loadQueue();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [roomId]);

  async function handleRemoveSong(songId: string) {
    if (updatingRef.current || draggingRef.current) {
      return;
    }

    updatingRef.current = true;
    queueVersionRef.current++;

    setRemovingId(songId);
    setRemoveError("");

    try {
      await removeSong(roomId, songId);

      setSongs((previousSongs) =>
        previousSongs.filter((song) => song._id !== songId),
      );
    } catch (error) {
      setRemoveError(
        error instanceof Error ? error.message : "Could not remove song.",
      );
    } finally {
      setRemovingId(null);
      updatingRef.current = false;
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    draggingRef.current = false;

    const { active, over } = event;

    if (!over || active.id === over.id || updatingRef.current) {
      return;
    }

    const oldIndex = songs.findIndex((song) => song._id === active.id);

    const newIndex = songs.findIndex((song) => song._id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const previousSongs = songs;
    const reorderedSongs = arrayMove(songs, oldIndex, newIndex);

    updatingRef.current = true;
    queueVersionRef.current++;

    setReordering(true);
    setReorderError("");
    setSongs(reorderedSongs);

    try {
      await reorderQueue(
        roomId,
        reorderedSongs.map((song) => song._id),
      );
    } catch (error) {
      setReorderError(
        error instanceof Error ? error.message : "Could not reorder queue.",
      );

      try {
        setSongs(await getQueue(roomId));
      } catch {
        setSongs(previousSongs);
      }
    } finally {
      setReordering(false);
      updatingRef.current = false;
    }
  }

  return (
    <div id="nextSongsList" className="mt-4">
      <h3>Up Next</h3>

      {error && <p role="alert">{error}</p>}
      {removeError && <p role="alert">{removeError}</p>}
      {reorderError && <p role="alert">{reorderError}</p>}

      {reordering && <p>Saving queue order...</p>}

      {!error && songs.length === 0 && <p>No songs in the queue yet.</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          draggingRef.current = true;
          queueVersionRef.current++;
        }}
        onDragCancel={() => {
          draggingRef.current = false;
        }}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <SortableContext
          items={songs.map((song) => song._id)}
          strategy={verticalListSortingStrategy}
        >
          {songs.map((song) => (
            <SortableSong
              key={song._id}
              song={song}
              removingId={removingId}
              disabled={reordering || removingId !== null}
              onRemove={(songId) => void handleRemoveSong(songId)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default NextSongsList;
