export const CLUB_AUDIT_ACTION = {
  COMMITTEE_PRICING_SAVED: "committee_pricing.saved",
  CLUB_WA_TEMPLATE_SAVED: "club_wa_template.saved",
  CLUB_WA_TEMPLATE_RESET: "club_wa_template.reset",
  CLUB_OPERATIONAL_SAVED: "club_operational.saved",
  CLUB_BRANDING_SAVED: "club_branding.saved",
  NOTIFICATION_PREFS_SAVED: "notification_preferences.saved",
  ADMIN_PROFILE_BOOTSTRAP_UPSERT: "admin_profile.bootstrap_upsert",
  ADMIN_PROFILE_CREATED_UI: "admin_profile.created_ui",
  ADMIN_PROFILE_ROLE_CHANGED: "admin_profile.role_changed",
  ADMIN_PROFILE_MEMBER_LINK_CHANGED: "admin_profile.member_link_changed",
  ADMIN_PROFILE_DELETED_UI: "admin_profile.deleted_ui",
  EVENT_DELETED_UI: "event.deleted_ui",
  MASTER_MEMBER_DELETED_UI: "master_member.deleted_ui",
} as const;

export type ClubAuditAction =
  (typeof CLUB_AUDIT_ACTION)[keyof typeof CLUB_AUDIT_ACTION];
