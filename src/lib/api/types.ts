/** JSON shapes returned by the Rust API (mirror `public.*` tables). */

export type ApiProfile = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiStory = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  content: string | null;
  type: string;
  universe_id: string | null;
  arc_id: string | null;
  tags: string[] | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
};

export type ApiStoryWithProfile = ApiStory & {
  profiles: { username: string; avatar_url: string | null } | null;
};

export type ApiUniverse = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type ApiArc = {
  id: string;
  universe_id: string;
  name: string;
  description: string | null;
  type: string;
  cover_image_url: string | null;
  created_at: string;
};

export type ApiErrorBody = {
  error: string;
};
