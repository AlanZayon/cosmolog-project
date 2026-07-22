use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

pub const MIN_PASSWORD_LEN: usize = 6;
pub const MAX_PASSWORD_LEN: usize = 128;

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| format!("password hash failed: {e}"))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_and_verifies_password() {
        let hash = hash_password("correct horse battery").expect("hash");
        assert!(hash.starts_with("$argon2"));
        assert!(verify_password("correct horse battery", &hash));
        assert!(!verify_password("wrong password", &hash));
    }

    #[test]
    fn different_hashes_for_same_password() {
        let a = hash_password("same-password").expect("hash");
        let b = hash_password("same-password").expect("hash");
        assert_ne!(a, b);
    }

    #[test]
    fn verify_rejects_invalid_hash_format() {
        assert!(!verify_password("anything", "not-a-phc-hash"));
    }
}
