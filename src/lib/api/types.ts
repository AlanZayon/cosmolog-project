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
  feed_display_mode: 'preview' | 'cover';
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

export type ApiComment = {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  likes_count: number;
  liked: boolean;
  username: string | null;
};

export type ApiErrorBody = {
  error: string;
};

export type NotificationSubscriptionScope = 'profile' | 'universe';

export type ApiNotificationSubscriptionStatus = {
  subscribed: boolean;
  active: boolean;
  scope: NotificationSubscriptionScope;
  universe_id: string | null;
  unconsumed_count: number;
  disabled_reason: 'unconsumed_threshold' | 'user' | null;
  disabled_at: string | null;
  last_consumed_at: string | null;
};

export type ApiNotificationListItem = {
  id: string;
  kind: 'new_story';
  story_id: string;
  story_title: string;
  read_at: string | null;
  clicked_at: string | null;
  created_at: string;
  scope: NotificationSubscriptionScope;
  target_user_id: string;
  target_username: string;
  target_avatar_url: string | null;
  universe_id: string | null;
  universe_title: string | null;
};

export type ApiNotificationListResponse = {
  items: ApiNotificationListItem[];
};

export type ApiNotificationUnreadCount = {
  count: number;
};

export type ApiConsumeNotificationResponse = {
  id: string;
  read_at: string;
  clicked_at: string;
  subscription_unconsumed_count: number;
};
