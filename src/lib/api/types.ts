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
  reading_mode: 'vertical' | 'horizontal' | 'both';
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
  codex_enabled?: boolean;
  saga_premise?: string | null;
  default_calendar_label?: string | null;
  afterword?: string | null;
  created_at: string;
  updated_at: string;
};

export type LoreEntryKind =
  | 'episode'
  | 'era'
  | 'event'
  | 'faction'
  | 'institution'
  | 'social_class'
  | 'place'
  | 'creature'
  | 'system'
  | 'glossary_term'
  | 'vehicle'
  | 'character'
  | 'drama_synopsis'
  | 'side_tale'
  | 'meta_essay'
  | 'custom';

export type LoreCanonStatus = 'canon' | 'apocrypha' | 'meta';
export type LorePublishState = 'draft' | 'published';

export type ApiLoreEntry = {
  id: string;
  universe_id: string;
  kind: LoreEntryKind;
  slug: string;
  title: string;
  summary: string | null;
  cover_image_url: string | null;
  canon_status: LoreCanonStatus;
  publish_state: LorePublishState;
  parent_entry_id: string | null;
  sort_key: number;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ApiLoreBlock = {
  id: string;
  entry_id: string;
  block_type: 'text' | 'image';
  content: string;
  block_order: number;
  created_at: string;
};

export type LoreRelationType =
  | 'related'
  | 'causes'
  | 'caused_by'
  | 'member_of'
  | 'rules'
  | 'subordinate_to'
  | 'allied_with'
  | 'at_war_with'
  | 'located_in'
  | 'habitat'
  | 'defines'
  | 'depends_on'
  | 'part_of'
  | 'piloted_by'
  | 'variant_of'
  | 'knows'
  | 'family'
  | 'rival'
  | 'serves'
  | 'reincarnation_of'
  | 'appears_with'
  | 'custom';

export type ApiLoreRelation = {
  id: string;
  universe_id: string;
  from_entry_id: string;
  to_entry_id: string;
  rel_type: LoreRelationType;
  label: string | null;
  created_at: string;
};

export type TimelineConfidence = 'confirmed' | 'uncertain' | 'legendary';

export type ApiTimelineEvent = {
  id: string;
  universe_id: string;
  title: string;
  summary: string | null;
  body: string;
  occurred_at_label: string | null;
  sort_key: number;
  era_entry_id: string | null;
  confidence: TimelineConfidence;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiLoreAppearance = {
  id: string;
  entry_id: string;
  story_id: string | null;
  chapter_id: string | null;
  timeline_event_id: string | null;
  note: string | null;
  created_at: string;
};

export type ApiMap = {
  id: string;
  universe_id: string;
  title: string;
  description: string | null;
  image_url: string;
  sort_key: number;
  created_at: string;
  updated_at: string;
};

export type ApiMapPin = {
  id: string;
  map_id: string;
  label: string;
  x_norm: number;
  y_norm: number;
  entry_id: string | null;
  created_at: string;
};

export type GalleryArtKind = 'final' | 'sketch' | 'map' | 'diagram';

export type ApiGalleryCollection = {
  id: string;
  universe_id: string;
  title: string;
  description: string | null;
  sort_key: number;
  created_at: string;
  updated_at: string;
};

export type ApiGalleryAsset = {
  id: string;
  collection_id: string;
  image_url: string;
  caption: string | null;
  art_kind: GalleryArtKind;
  entry_id: string | null;
  sort_key: number;
  created_at: string;
};

export type CodexTocHrefKind = 'cover' | 'timeline' | 'gallery' | 'index' | 'maps' | 'entry' | 'kind';

export type ApiCodexTocItem = {
  id: string;
  universe_id: string;
  title: string;
  section_key: string | null;
  entry_id: string | null;
  href_kind: CodexTocHrefKind | null;
  sort_key: number;
  created_at: string;
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

export type ApiNotificationSubscriptionListItem = {
  id: string;
  scope: NotificationSubscriptionScope;
  target_user_id: string;
  target_username: string;
  target_avatar_url: string | null;
  universe_id: string | null;
  universe_title: string | null;
  universe_cover_image_url: string | null;
  unconsumed_count: number;
  created_at: string;
  updated_at: string;
};

export type ApiNotificationSubscriptionListResponse = {
  items: ApiNotificationSubscriptionListItem[];
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

export type ActivityNotificationKind =
  | 'comment_mention'
  | 'story_comment'
  | 'comment_reply'
  | 'comment_liked'
  | 'profile_alert_activated'
  | 'universe_alert_activated'
  | 'collection_saved';

export type ApiActivityNotificationListItem = {
  id: string;
  kind: ActivityNotificationKind;
  read_at: string | null;
  clicked_at: string | null;
  created_at: string;
  actor_id: string;
  actor_username: string;
  actor_avatar_url: string | null;
  story_id: string | null;
  story_title: string | null;
  comment_id: string | null;
  universe_id: string | null;
  universe_title: string | null;
  collection_id: string | null;
  collection_name: string | null;
};

export type ApiActivityNotificationListResponse = {
  items: ApiActivityNotificationListItem[];
};

export type ApiActivityNotificationUnreadCount = {
  count: number;
};

export type ApiMarkActivityNotificationReadResponse = {
  id: string;
  read_at: string;
  clicked_at: string;
};

export type ApiMarkAllActivityNotificationsReadResponse = {
  marked_count: number;
};

export type ApiMarkAllNotificationsReadResponse = {
  marked_count: number;
};
