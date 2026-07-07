package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// tokenTTL — 7-day access token, no refresh (per PRD §8.1).
const tokenTTL = 7 * 24 * time.Hour

// bcryptCost — cost factor 12 (per PRD §8.3).
const bcryptCost = 12

var ErrInvalidToken = errors.New("auth: invalid token")

// Claims embedded in the JWT.
type Claims struct {
	UserID uuid.UUID `json:"userId"`
	Email  string    `json:"email"`
	jwt.RegisteredClaims
}

// HashPassword returns a bcrypt hash of the plaintext password.
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	return string(b), err
}

// CheckPassword reports whether plain matches the stored hash.
func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// GenerateToken issues a signed HMAC-SHA256 access token.
func GenerateToken(secret string, userID uuid.UUID, email string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tokenTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ParseToken validates the signature + expiry and returns the claims.
func ParseToken(secret, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
