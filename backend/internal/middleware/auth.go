package middleware

import (
	"net/http"
	"strings"

	"knowledgecanvas/internal/auth"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const ctxUserID = "userID"
const ctxEmail = "userEmail"

// Auth validates the Bearer token and injects userID/email into the Gin context.
func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Missing or malformed Authorization header",
			})
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ParseToken(secret, tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid or expired token",
			})
			return
		}
		c.Set(ctxUserID, claims.UserID)
		c.Set(ctxEmail, claims.Email)
		c.Next()
	}
}

// UserID returns the authenticated user's ID from the context.
func UserID(c *gin.Context) uuid.UUID {
	v, _ := c.Get(ctxUserID)
	id, _ := v.(uuid.UUID)
	return id
}

// Email returns the authenticated user's email from the context.
func Email(c *gin.Context) string {
	v, _ := c.Get(ctxEmail)
	s, _ := v.(string)
	return s
}
