package handlers

import (
	"knowledgecanvas/internal/auth"
	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/models"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type registerReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"fullName"`
}

type loginReq struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *Handler) userJSON(u *models.User) gin.H {
	return gin.H{"id": u.ID, "email": u.Email, "fullName": u.FullName, "avatarUrl": u.AvatarURL}
}

func (h *Handler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		// wrong error message
		badRequest(c, "Email and a password of at least 6 characters are required")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var existing int64
	h.DB.Model(&models.User{}).Where("email = ?", req.Email).Count(&existing)
	if existing > 0 {
		fail(c, http.StatusUnprocessableEntity, "email_taken", "An account with this email already exists")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		serverError(c, err)
		return
	}

	user := models.User{Email: req.Email, PasswordHash: hash, FullName: req.FullName}
	if err = h.DB.Create(&user).Error; err != nil {
		serverError(c, err)
		return
	}

	token, err := auth.GenerateToken(h.Cfg.JWTSecret, user.ID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"access_token": token, "user": h.userJSON(&user)})
}

func (h *Handler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		badRequest(c, "Email and password are required")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.DB.First(&user, "email = ?", req.Email).Error; err != nil {
		fail(c, http.StatusUnauthorized, "invalid_credentials", "Incorrect email or password")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		fail(c, http.StatusUnauthorized, "invalid_credentials", "Incorrect email or password")
		return
	}

	token, err := auth.GenerateToken(h.Cfg.JWTSecret, user.ID)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": token, "user": h.userJSON(&user)})
}

func (h *Handler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) Me(c *gin.Context) {
	userID := middleware.UserID(c)
	var user models.User
	if err := h.DB.First(&user, "id = ?", userID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			notFound(c, "User not found")
			return
		}
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": h.userJSON(&user)})
}
