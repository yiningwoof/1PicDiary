export type DiarySubject = {
  id: string;
  name: string;
  diary_album_title: string;
  save_originals: boolean;
  originals_album_title: string | null;
};
