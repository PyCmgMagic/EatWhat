// Generated from backend v2 OpenAPI by npm run api:generate.
export const endpoints = {
  "sdu": {
    "method": "GET",
    "path": "/auth/sdu",
    "access": "login"
  },
  "startSso": {
    "method": "POST",
    "path": "/auth/sdu",
    "access": "login"
  },
  "updateInfo": {
    "method": "PUT",
    "path": "/user/updateInfo",
    "access": "login"
  },
  "getUserRecommendationSettings": {
    "method": "GET",
    "path": "/user/recommendation-settings",
    "access": "login"
  },
  "putUserRecommendationSettings": {
    "method": "PUT",
    "path": "/user/recommendation-settings",
    "access": "login"
  },
  "preferences": {
    "method": "GET",
    "path": "/user/recommendation-profile/preferences",
    "access": "login"
  },
  "savePreferences": {
    "method": "PUT",
    "path": "/user/recommendation-profile/preferences",
    "access": "login"
  },
  "clearPreferences": {
    "method": "DELETE",
    "path": "/user/recommendation-profile/preferences",
    "access": "login"
  },
  "blockStatus": {
    "method": "GET",
    "path": "/user/blocks/{userId}",
    "access": "login"
  },
  "block": {
    "method": "PUT",
    "path": "/user/blocks/{userId}",
    "access": "login"
  },
  "unblock": {
    "method": "DELETE",
    "path": "/user/blocks/{userId}",
    "access": "login"
  },
  "getTelemetryConsent": {
    "method": "GET",
    "path": "/telemetry/consent",
    "access": "public"
  },
  "putTelemetryConsent": {
    "method": "PUT",
    "path": "/telemetry/consent",
    "access": "public"
  },
  "deleteTelemetryConsent": {
    "method": "DELETE",
    "path": "/telemetry/consent",
    "access": "public"
  },
  "rate": {
    "method": "PUT",
    "path": "/restaurant/{id}/rating",
    "access": "verifiedOrAdmin"
  },
  "unrate": {
    "method": "DELETE",
    "path": "/restaurant/{id}/rating",
    "access": "login"
  },
  "favorite": {
    "method": "PUT",
    "path": "/restaurant/{id}/favorite",
    "access": "verifiedOrAdmin"
  },
  "unfavorite": {
    "method": "DELETE",
    "path": "/restaurant/{id}/favorite",
    "access": "login"
  },
  "editRestaurant": {
    "method": "PUT",
    "path": "/restaurant/edit/{id}",
    "access": "verifiedOrAdmin"
  },
  "editHub": {
    "method": "PUT",
    "path": "/hub/edit/{id}",
    "access": "admin"
  },
  "putFoodsEditById": {
    "method": "PUT",
    "path": "/foods/edit/{id}",
    "access": "verifiedOrAdmin"
  },
  "putCommentsByIdLike": {
    "method": "PUT",
    "path": "/comments/{id}/like",
    "access": "verifiedOrAdmin"
  },
  "deleteCommentsByIdLike": {
    "method": "DELETE",
    "path": "/comments/{id}/like",
    "access": "login"
  },
  "putAdminRemoteConfigVersionsByPlatform": {
    "method": "PUT",
    "path": "/admin/remote-config/versions/{platform}",
    "access": "admin"
  },
  "putAdminRemoteConfigSettings": {
    "method": "PUT",
    "path": "/admin/remote-config/settings",
    "access": "admin"
  },
  "putAdminRemoteConfigAnnouncementsById": {
    "method": "PUT",
    "path": "/admin/remote-config/announcements/{id}",
    "access": "admin"
  },
  "deleteAdminRemoteConfigAnnouncementsById": {
    "method": "DELETE",
    "path": "/admin/remote-config/announcements/{id}",
    "access": "admin"
  },
  "getAdminAiSettings": {
    "method": "GET",
    "path": "/admin/ai/settings",
    "access": "admin"
  },
  "putAdminAiSettings": {
    "method": "PUT",
    "path": "/admin/ai/settings",
    "access": "admin"
  },
  "unfollow": {
    "method": "POST",
    "path": "/user/unfollow",
    "access": "login"
  },
  "unban": {
    "method": "POST",
    "path": "/user/unban/{userId}",
    "access": "admin"
  },
  "changeOldCode": {
    "method": "POST",
    "path": "/user/mobile/change/old-code",
    "access": "login",
    "captcha": "required"
  },
  "changeNewCode": {
    "method": "POST",
    "path": "/user/mobile/change/new-code",
    "access": "login",
    "captcha": "required"
  },
  "changeCommit": {
    "method": "POST",
    "path": "/user/mobile/change/commit",
    "access": "login"
  },
  "userCode": {
    "method": "POST",
    "path": "/user/getCode",
    "access": "login",
    "captcha": "required"
  },
  "follow": {
    "method": "POST",
    "path": "/user/follow",
    "access": "verified"
  },
  "changePrivacy": {
    "method": "POST",
    "path": "/user/changePrivacy",
    "access": "login"
  },
  "bindMobile": {
    "method": "POST",
    "path": "/user/bindMobile",
    "access": "login"
  },
  "ban": {
    "method": "POST",
    "path": "/user/ban/{userId}",
    "access": "admin"
  },
  "presign": {
    "method": "POST",
    "path": "/upload/presign",
    "access": "login"
  },
  "presignBatch": {
    "method": "POST",
    "path": "/upload/presign/batch",
    "access": "login"
  },
  "complete": {
    "method": "POST",
    "path": "/upload/complete",
    "access": "login"
  },
  "postTelemetryEvents": {
    "method": "POST",
    "path": "/telemetry/events",
    "access": "public"
  },
  "restore": {
    "method": "POST",
    "path": "/restaurant/{id}/history/{revisionId}/restore",
    "access": "verifiedOrAdmin"
  },
  "addRestaurant": {
    "method": "POST",
    "path": "/restaurant/add",
    "access": "verifiedOrAdmin"
  },
  "dismiss": {
    "method": "POST",
    "path": "/recommend/dismiss/{id}",
    "access": "login"
  },
  "postPushSettingsEnable": {
    "method": "POST",
    "path": "/push/settings/enable",
    "access": "login"
  },
  "postPushSettingsDisable": {
    "method": "POST",
    "path": "/push/settings/disable",
    "access": "login"
  },
  "postPushBindings": {
    "method": "POST",
    "path": "/push/bindings",
    "access": "login"
  },
  "postPushBindingsByIdUnbind": {
    "method": "POST",
    "path": "/push/bindings/{id}/unbind",
    "access": "login"
  },
  "postPushBindingsByIdToken": {
    "method": "POST",
    "path": "/push/bindings/{id}/token",
    "access": "login"
  },
  "postNotificationCardsByIdRead": {
    "method": "POST",
    "path": "/notification/cards/{id}/read",
    "access": "login"
  },
  "postNotificationCardsReadAll": {
    "method": "POST",
    "path": "/notification/cards/read-all",
    "access": "login"
  },
  "addHub": {
    "method": "POST",
    "path": "/hub/add",
    "access": "admin"
  },
  "postFoodsByIdUnlike": {
    "method": "POST",
    "path": "/foods/{id}/unlike",
    "access": "login"
  },
  "postFoodsByIdUnfavorite": {
    "method": "POST",
    "path": "/foods/{id}/unfavorite",
    "access": "login"
  },
  "postFoodsByIdLike": {
    "method": "POST",
    "path": "/foods/{id}/like",
    "access": "verifiedOrAdmin"
  },
  "postFoodsByIdHistoryByRevisionIdRestore": {
    "method": "POST",
    "path": "/foods/{id}/history/{revisionId}/restore",
    "access": "verifiedOrAdmin"
  },
  "postFoodsByIdFavorite": {
    "method": "POST",
    "path": "/foods/{id}/favorite",
    "access": "verifiedOrAdmin"
  },
  "getFoodsByFoodIdComments": {
    "method": "GET",
    "path": "/foods/{foodId}/comments",
    "access": "public"
  },
  "postFoodsByFoodIdComments": {
    "method": "POST",
    "path": "/foods/{foodId}/comments",
    "access": "verifiedOrAdmin"
  },
  "postFoodsByFoodIdCommentsByCommentIdReplies": {
    "method": "POST",
    "path": "/foods/{foodId}/comments/{commentId}/replies",
    "access": "verifiedOrAdmin"
  },
  "postFoodsUpload": {
    "method": "POST",
    "path": "/foods/upload",
    "access": "verifiedOrAdmin"
  },
  "postFoodsSuggestTags": {
    "method": "POST",
    "path": "/foods/suggest-tags",
    "access": "verifiedOrAdmin"
  },
  "postFeedbackReports": {
    "method": "POST",
    "path": "/feedback/reports",
    "access": "login"
  },
  "postFeedbackMessages": {
    "method": "POST",
    "path": "/feedback/messages",
    "access": "login"
  },
  "postFeedbackCatalogErrors": {
    "method": "POST",
    "path": "/feedback/catalog-errors",
    "access": "login"
  },
  "postDeviceRegister": {
    "method": "POST",
    "path": "/device/register",
    "access": "public"
  },
  "verifyEmail": {
    "method": "POST",
    "path": "/auth/verifyEmail",
    "access": "login"
  },
  "usernameSet": {
    "method": "POST",
    "path": "/auth/username/set",
    "access": "login"
  },
  "revokeOthers": {
    "method": "POST",
    "path": "/auth/sessions/revoke-others",
    "access": "login"
  },
  "sendEmail": {
    "method": "POST",
    "path": "/auth/sendEmail",
    "access": "login",
    "captcha": "required"
  },
  "sduConfirm": {
    "method": "POST",
    "path": "/auth/sdu/confirm",
    "access": "login"
  },
  "register": {
    "method": "POST",
    "path": "/auth/register",
    "access": "public"
  },
  "postAuthPhoneWebVerifyToken": {
    "method": "POST",
    "path": "/auth/phone/web-verify/token",
    "access": "public"
  },
  "postAuthPhoneWebVerifyLogin": {
    "method": "POST",
    "path": "/auth/phone/web-verify/login",
    "access": "public"
  },
  "postAuthPhoneOneClickLogin": {
    "method": "POST",
    "path": "/auth/phone/one-click/login",
    "access": "public"
  },
  "phoneLogin": {
    "method": "POST",
    "path": "/auth/phone/login",
    "access": "public"
  },
  "phoneCode": {
    "method": "POST",
    "path": "/auth/phone/code",
    "access": "public",
    "captcha": "required"
  },
  "passwordReset": {
    "method": "POST",
    "path": "/auth/password/reset",
    "access": "login"
  },
  "passwordCode": {
    "method": "POST",
    "path": "/auth/password/code",
    "access": "login",
    "captcha": "required"
  },
  "logout": {
    "method": "POST",
    "path": "/auth/logout",
    "access": "login",
    "consentExempt": true
  },
  "login": {
    "method": "POST",
    "path": "/auth/login",
    "access": "public",
    "captcha": "onDemand"
  },
  "grant": {
    "method": "POST",
    "path": "/auth/consent/grant",
    "access": "login",
    "consentExempt": true
  },
  "checkUsername": {
    "method": "POST",
    "path": "/auth/checkUsername",
    "access": "public"
  },
  "changePassword": {
    "method": "POST",
    "path": "/auth/changePassword",
    "access": "login"
  },
  "postAuthAccountDelete": {
    "method": "POST",
    "path": "/auth/account/delete",
    "access": "login",
    "consentExempt": true
  },
  "postAuthAccountDeleteCode": {
    "method": "POST",
    "path": "/auth/account/delete/code",
    "access": "login",
    "consentExempt": true,
    "captcha": "required"
  },
  "adminResetPassword": {
    "method": "POST",
    "path": "/admin/users/{userId}/password",
    "access": "admin"
  },
  "getAdminRemoteConfigAnnouncements": {
    "method": "GET",
    "path": "/admin/remote-config/announcements",
    "access": "admin"
  },
  "postAdminRemoteConfigAnnouncements": {
    "method": "POST",
    "path": "/admin/remote-config/announcements",
    "access": "admin"
  },
  "postAdminFeedbackCasesByIdResolution": {
    "method": "POST",
    "path": "/admin/feedback/cases/{id}/resolution",
    "access": "admin"
  },
  "policies": {
    "method": "GET",
    "path": "/admin/consent/policies",
    "access": "admin"
  },
  "publishPolicy": {
    "method": "POST",
    "path": "/admin/consent/policies",
    "access": "admin"
  },
  "postAdminAiSettingsTest": {
    "method": "POST",
    "path": "/admin/ai/settings/test",
    "access": "admin"
  },
  "userInfo": {
    "method": "GET",
    "path": "/user/userInfo",
    "access": "login"
  },
  "getUserRecommendationProfileTaste": {
    "method": "GET",
    "path": "/user/recommendation-profile/taste",
    "access": "login"
  },
  "users": {
    "method": "GET",
    "path": "/user/list",
    "access": "admin"
  },
  "getUserLevel": {
    "method": "GET",
    "path": "/user/level",
    "access": "login"
  },
  "getUserLevelLogs": {
    "method": "GET",
    "path": "/user/level/logs",
    "access": "login"
  },
  "me": {
    "method": "GET",
    "path": "/user/info",
    "access": "login"
  },
  "followings": {
    "method": "GET",
    "path": "/user/followings",
    "access": "login"
  },
  "followers": {
    "method": "GET",
    "path": "/user/followers",
    "access": "login"
  },
  "blocks": {
    "method": "GET",
    "path": "/user/blocks",
    "access": "login"
  },
  "history": {
    "method": "GET",
    "path": "/restaurant/{id}/history",
    "access": "public"
  },
  "restaurants": {
    "method": "GET",
    "path": "/restaurant/list",
    "access": "admin"
  },
  "favorites": {
    "method": "GET",
    "path": "/restaurant/favorites",
    "access": "login"
  },
  "getRestaurantDuplicates": {
    "method": "GET",
    "path": "/restaurant/duplicates",
    "access": "public"
  },
  "restaurant": {
    "method": "GET",
    "path": "/restaurant/detail/{id}",
    "access": "public"
  },
  "search": {
    "method": "GET",
    "path": "/restaurant/search",
    "access": "public"
  },
  "browse": {
    "method": "GET",
    "path": "/restaurant/browse",
    "access": "public"
  },
  "getRemoteConfig": {
    "method": "GET",
    "path": "/remote-config",
    "access": "public"
  },
  "recommend": {
    "method": "GET",
    "path": "/recommend",
    "access": "public"
  },
  "tags": {
    "method": "GET",
    "path": "/recommend/tags",
    "access": "public"
  },
  "pick": {
    "method": "GET",
    "path": "/recommend/pick",
    "access": "public"
  },
  "getPushSettings": {
    "method": "GET",
    "path": "/push/settings",
    "access": "login"
  },
  "getNotificationCards": {
    "method": "GET",
    "path": "/notification/cards",
    "access": "login"
  },
  "getNotificationCardsUnreadCount": {
    "method": "GET",
    "path": "/notification/cards/unread/count",
    "access": "login"
  },
  "locate": {
    "method": "GET",
    "path": "/hub/locate",
    "access": "public"
  },
  "hubs": {
    "method": "GET",
    "path": "/hub/list",
    "access": "public"
  },
  "hub": {
    "method": "GET",
    "path": "/hub/detail/{id}",
    "access": "public"
  },
  "getHistoryBrowse": {
    "method": "GET",
    "path": "/history/browse",
    "access": "login"
  },
  "deleteHistoryBrowse": {
    "method": "DELETE",
    "path": "/history/browse",
    "access": "login"
  },
  "getFoodsByIdHistory": {
    "method": "GET",
    "path": "/foods/{id}/history",
    "access": "public"
  },
  "getFoodsByFoodIdGallery": {
    "method": "GET",
    "path": "/foods/{foodId}/gallery",
    "access": "public"
  },
  "getFoodsOptions": {
    "method": "GET",
    "path": "/foods/options",
    "access": "public"
  },
  "getFoodsMy": {
    "method": "GET",
    "path": "/foods/my",
    "access": "login"
  },
  "getFoodsList": {
    "method": "GET",
    "path": "/foods/list",
    "access": "public"
  },
  "getFoodsFavorites": {
    "method": "GET",
    "path": "/foods/favorites",
    "access": "login"
  },
  "getFoodDuplicates": {
    "method": "GET",
    "path": "/foods/duplicates",
    "access": "public"
  },
  "getFoodsDetailById": {
    "method": "GET",
    "path": "/foods/detail/{id}",
    "access": "public"
  },
  "getFoodsByUserByUserId": {
    "method": "GET",
    "path": "/foods/by-user/{userId}",
    "access": "login"
  },
  "getFeedbackMine": {
    "method": "GET",
    "path": "/feedback/mine",
    "access": "login"
  },
  "getFeedbackMineById": {
    "method": "GET",
    "path": "/feedback/mine/{id}",
    "access": "login"
  },
  "getCommentsByCommentIdReplies": {
    "method": "GET",
    "path": "/comments/{commentId}/replies",
    "access": "public"
  },
  "getCommentsMy": {
    "method": "GET",
    "path": "/comments/my",
    "access": "login"
  },
  "campuses": {
    "method": "GET",
    "path": "/campus/list",
    "access": "public"
  },
  "verify": {
    "method": "GET",
    "path": "/auth/verify",
    "access": "login"
  },
  "sessions": {
    "method": "GET",
    "path": "/auth/sessions",
    "access": "login"
  },
  "getAuthPhoneWebVerifyConfig": {
    "method": "GET",
    "path": "/auth/phone/web-verify/config",
    "access": "public"
  },
  "getAuthPhoneOneClickConfig": {
    "method": "GET",
    "path": "/auth/phone/one-click/config",
    "access": "public"
  },
  "consentStatus": {
    "method": "GET",
    "path": "/auth/consent",
    "access": "login",
    "consentExempt": true
  },
  "currentPolicy": {
    "method": "GET",
    "path": "/auth/consent/policy",
    "access": "public",
    "consentExempt": true
  },
  "captchaConfig": {
    "method": "GET",
    "path": "/auth/captcha/config",
    "access": "public"
  },
  "summary": {
    "method": "GET",
    "path": "/admin/summary",
    "access": "admin"
  },
  "getAdminRemoteConfig": {
    "method": "GET",
    "path": "/admin/remote-config",
    "access": "admin"
  },
  "getAdminRemoteConfigAudit": {
    "method": "GET",
    "path": "/admin/remote-config/audit",
    "access": "admin"
  },
  "getAdminFeedbackCases": {
    "method": "GET",
    "path": "/admin/feedback/cases",
    "access": "admin"
  },
  "getAdminFeedbackCasesById": {
    "method": "GET",
    "path": "/admin/feedback/cases/{id}",
    "access": "admin"
  },
  "getAdminEngagementStats": {
    "method": "GET",
    "path": "/admin/engagement/stats",
    "access": "admin"
  },
  "policyDetail": {
    "method": "GET",
    "path": "/admin/consent/policies/{id}",
    "access": "admin"
  },
  "deleteRestaurant": {
    "method": "DELETE",
    "path": "/restaurant/delete/{id}",
    "access": "admin"
  },
  "deleteHub": {
    "method": "DELETE",
    "path": "/hub/delete/{id}",
    "access": "admin"
  },
  "deleteFoodsDeleteById": {
    "method": "DELETE",
    "path": "/foods/delete/{id}",
    "access": "admin"
  },
  "deleteCommentsByCommentId": {
    "method": "DELETE",
    "path": "/comments/{commentId}",
    "access": "login"
  },
  "revoke": {
    "method": "DELETE",
    "path": "/auth/sessions/{sessionId}",
    "access": "login"
  }
} as const;
