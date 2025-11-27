/*
  # Insert Admin User

  1. Admin User Details
    - Email: admin@gmail.com
    - Password: VCFGJYHASG#@#422
    - Password hash: $2b$10$4ztXV6v8KrCCR.h0Zi.3WeR7OxKB8tJKHqLPEGpHQ3wZLMFxEBr2G (bcrypt)
*/

INSERT INTO users (email, password_hash)
VALUES ('admin@gmail.com', '$2b$10$4ztXV6v8KrCCR.h0Zi.3WeR7OxKB8tJKHqLPEGpHQ3wZLMFxEBr2G')
ON CONFLICT (email) DO NOTHING;
