import appConfig from '../../app.json';

export const APP_VERSION = appConfig.expo.version;
export const APP_BUILD_NUMBER = appConfig.expo.android.versionCode;
export const APP_VERSION_LABEL = `v${APP_VERSION} (Build ${APP_BUILD_NUMBER})`;
