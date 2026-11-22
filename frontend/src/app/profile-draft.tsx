import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "../api/models";
import {
  profileChanges,
  profileForm,
  type ProfileForm,
} from "../desktop/profile";
import type { Draft } from "../mobile/ui";
import {
  readDraft,
  removeDraft,
  useMemoryDraft,
  useSessionDraft,
} from "./drafts";
import { readSession, sessionSignal } from "./runtime";
import { useApp } from "./state";

type Avatar = Draft["images"][number];

function useProfileDraftState(editing: boolean) {
  const app = useApp();
  const cache = useQueryClient();
  const user = editing ? app.user : undefined;
  const userId = user?.id;
  const [baseline, setBaseline] = useState(() => ({
    userId,
    form: profileForm(user ?? {}),
  }));
  const current =
    baseline.userId === userId
      ? baseline
      : { userId, form: profileForm(user ?? {}) };
  if (current !== baseline) setBaseline(current);
  const saved = current.form;
  const key = `profile:${userId}`;
  const legacyKey = `profile-mobile:${userId}`;
  const legacy =
    userId !== undefined &&
    readDraft(legacyKey, {
      nick: saved.name,
      sign: saved.signature,
      gender: saved.gender,
      birthday: saved.birthday,
    });
  const [form, setForm, clearForm] = useSessionDraft<ProfileForm>(
    key,
    legacy
      ? {
          name: legacy.nick,
          signature: legacy.sign,
          gender: legacy.gender,
          birthday: legacy.birthday,
        }
      : saved,
  );
  const [avatar, setAvatarDraft, clearAvatar] = useMemoryDraft<Avatar | null>(
    key,
    null,
  );
  const [phase, setPhase] = useState("");
  const saving = useRef(false);
  const uploaded = useRef<{ file: File; key: string } | null>(null);

  function setAvatar(next: Avatar | null) {
    if (avatar?.url) URL.revokeObjectURL(avatar.url);
    setAvatarDraft(next);
    if (!next) clearAvatar();
    uploaded.current = null;
  }

  function change(patch: Partial<ProfileForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function clear(profile: ProfileForm) {
    setForm(profile);
    clearForm();
    removeDraft(legacyKey);
  }

  function reset() {
    clear(saved);
    setAvatar(null);
  }

  // Both presentations share the same in-flight request and pending image.
  // The mobile chooser also supports updating just the avatar immediately.
  async function save(avatarOnly?: File) {
    if (!user || saving.current) return false;
    saving.current = true;
    const owner = sessionSignal(app.session);
    const checkOwner = () => {
      readSession();
      owner.throwIfAborted();
    };
    try {
      const body = avatarOnly ? {} : profileChanges(form, saved);
      const file = avatarOnly ?? avatar?.file;
      if (file) {
        if (uploaded.current?.file !== file) {
          setPhase("正在上传头像…");
          uploaded.current = { file, key: await app.upload(file, "avatar") };
        }
        checkOwner();
        body.avatar = uploaded.current.key;
      }
      setPhase("正在保存资料…");
      if (Object.keys(body).length) await app.api.updateProfile(body);
      // A successful write acknowledges these fields even if readback fails.
      let updated: User = { ...user, ...body };
      try {
        updated = await app.api.me();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
      }
      checkOwner();
      cache.setQueryData(["me"], updated);
      if (!avatarOnly) {
        const next = profileForm(updated);
        setBaseline((previous) =>
          previous.userId === userId ? { userId, form: next } : previous,
        );
        clear(next);
      }
      setAvatar(null);
      void cache.invalidateQueries({ queryKey: ["user"] });
      return true;
    } catch (error) {
      checkOwner();
      throw error;
    } finally {
      saving.current = false;
      setPhase("");
    }
  }

  return { form, saved, avatar, setAvatar, change, reset, save, phase };
}

const ProfileDraftContext = createContext<ReturnType<
  typeof useProfileDraftState
> | null>(null);

export function ProfileDraftProvider({
  editing,
  children,
}: {
  editing: boolean;
  children: ReactNode;
}) {
  const profile = useProfileDraftState(editing);
  return (
    <ProfileDraftContext.Provider value={editing ? profile : null}>
      {children}
    </ProfileDraftContext.Provider>
  );
}

export function useProfileDraft() {
  return useContext(ProfileDraftContext);
}
