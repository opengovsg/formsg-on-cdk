export default {
  APP_NAME: 'Form',
  APP_DESC: 'Official government forms',
  APP_URL: 'https://form.demos.sg',
  FE_APP_URL: 'https://form.demos.sg',

  // S3 Bucket config
  ATTACHMENT_S3_BUCKET: 'form-attachment-bucket',
  PAYMENT_PROOF_S3_BUCKET: 'form-payment-proof-bucket',
  IMAGE_S3_BUCKET: 'form-image-bucket',
  LOGO_S3_BUCKET: 'form-logo-bucket',
  STATIC_ASSETS_S3_BUCKET: 'form-static-assets-bucket',
  VIRUS_SCANNER_QUARANTINE_S3_BUCKET: 'form-virus-scanner-quarantine-bucket',
  VIRUS_SCANNER_CLEAN_S3_BUCKET: 'form-virus-scanner-clean-bucket',
  FORMSG_SDK_MODE: 'development',
  BOUNCE_LIFE_SPAN: '86400000',
  SECRET_ENV: 'development',
  SUBMISSIONS_RATE_LIMIT: '200',
  SEND_AUTH_OTP_RATE_LIMIT: '60',
  SENTRY_CONFIG_URL: 'https://random@sentry.io/123456',
  CSP_REPORT_URI: 'https://random@sentry.io/123456',

  // Test credentials from reCAPTCHA docs
  // https://developers.google.com/recaptcha/docs/faq#id-like-to-run-automated-tests-with-recaptcha.-what-should-i-do
  GOOGLE_CAPTCHA: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe',
  GOOGLE_CAPTCHA_PUBLIC: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',

  // Keep in sync with the development key in
  // https://github.com/opengovsg/formsg-javascript-sdk/blob/develop/src/resource/verification-keys.ts
  VERIFICATION_SECRET_KEY: 'iGkfOuI6uxrlfw+7CZFFUZBwk86I+pu6v+g7EWA6qJpJnilXQleCPx2EVTr24eWWphzFO2WJiaL53oyXnqWdBQ==',

  // Keep in sync with the development key in
  // https://github.com/opengovsg/formsg-javascript-sdk/blob/develop/src/resource/signing-keys.ts
  SIGNING_SECRET_KEY: 'HDBXpu+2/gu10bLHpy8HjpN89xbA6boH9GwibPGJA8BOXmB+zOUpxCP33/S5p8vBWlPokC7gLR0ca8urVwfMUQ==',

  // Mock Twilio credentials. SMSes do not work in dev environment.
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_API_KEY: 'mockTwilioApiKey',
  TWILIO_API_SECRET: 'mockTwilioApiSecret',
  TWILIO_MESSAGING_SERVICE_SID: 'MG00000000000000000000000000000000',

  SP_OIDC_NDI_DISCOVERY_ENDPOINT: 'https://mockpass.demos.sg/singpass/v2/.well-known/openid-configuration',
  SP_OIDC_NDI_JWKS_ENDPOINT: 'https://mockpass.demos.sg/singpass/v2/.well-known/keys',
  SP_OIDC_RP_CLIENT_ID: 'rpClientId',
  SP_OIDC_RP_REDIRECT_URL: 'https://form.demos.sg/api/v3/singpass/login',
  SP_OIDC_RP_JWKS_PUBLIC_PATH: './__tests__/setup/certs/test_sp_rp_public_jwks.json',
  SP_OIDC_RP_JWKS_SECRET_PATH: './__tests__/setup/certs/test_sp_rp_secret_jwks.json',
  CP_OIDC_NDI_DISCOVERY_ENDPOINT: 'https://mockpass.demos.sg/corppass/v2/.well-known/openid-configuration',
  CP_OIDC_NDI_JWKS_ENDPOINT: 'https://mockpass.demos.sg/corppass/v2/.well-known/keys',
  CP_OIDC_RP_CLIENT_ID: 'rpClientId',
  CP_OIDC_RP_REDIRECT_URL: 'https://form.demos.sg/api/v3/corppass/login',
  CP_OIDC_RP_JWKS_PUBLIC_PATH: './__tests__/setup/certs/test_cp_rp_public_jwks.json',
  CP_OIDC_RP_JWKS_SECRET_PATH: './__tests__/setup/certs/test_cp_rp_secret_jwks.json',
  // Needed for MyInfo
  SINGPASS_ESRVC_ID: 'spEsrvcId' ,
  MYINFO_CLIENT_CONFIG: 'dev',

  // Use mockpass key pairs and endpoints
  MYINFO_FORMSG_KEY_PATH: './node_modules/@opengovsg/mockpass/static/certs/key.pem',
  MYINFO_CERT_PATH: './node_modules/@opengovsg/mockpass/static/certs/spcp.crt',
  MYINFO_CLIENT_ID: 'mockClientId',
  MYINFO_CLIENT_SECRET: 'mockClientSecret',
  MYINFO_JWT_SECRET: 'mockJwtSecret',
  SGID_HOSTNAME: 'https://mockpass.demos.sg',
  SGID_CLIENT_ID: 'sgidclientid',
  SGID_CLIENT_SECRET: 'sgidclientsecret',
  SGID_JWT_SECRET: 'sgidjwtsecret',
  SGID_ADMIN_LOGIN_REDIRECT_URI: 'https://form.demos.sg/api/v3/auth/sgid/login/callback',
  SGID_FORM_LOGIN_REDIRECT_URI: 'https://form.demos.sg/sgid/login',
  SGID_PRIVATE_KEY: './node_modules/@opengovsg/mockpass/static/certs/key.pem',
  SGID_PUBLIC_KEY: './node_modules/@opengovsg/mockpass/static/certs/server.crt',

  SSM_ENV_SITE_NAME: 'development',
  // Bearer token API key format
  API_KEY_VERSION: 'v1',
  // env vars for virus scanner
  VIRUS_SCANNER_LAMBDA_FUNCTION_NAME: 'function',

  GA_TRACKING_ID: 'mockGATrackingId',

  POSTMAN_INTERNAL_CAMPAIGN_ID: 'notused',
  POSTMAN_INTERNAL_CAMPAIGN_API_KEY: 'notused',
  POSTMAN_MOP_CAMPAIGN_ID: 'notused',
  POSTMAN_MOP_CAMPAIGN_API_KEY: 'notused',
  POSTMAN_BASE_URL: 'notused',
}
