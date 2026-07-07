package middleware

import (
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// ipRateLimiter keeps a token-bucket limiter per client IP.
type ipRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	r        rate.Limit
	burst    int
}

func newIPRateLimiter(r rate.Limit, burst int) *ipRateLimiter {
	return &ipRateLimiter{limiters: make(map[string]*rate.Limiter), r: r, burst: burst}
}

func (l *ipRateLimiter) get(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()
	lim, ok := l.limiters[ip]
	if !ok {
		lim = rate.NewLimiter(l.r, l.burst)
		l.limiters[ip] = lim
	}
	return lim
}

// RateLimit limits each IP to ~rpm requests/minute (per PRD §9.3, 100/min on auth).
func RateLimit(rpm int) gin.HandlerFunc {
	limiter := newIPRateLimiter(rate.Limit(float64(rpm)/60.0), rpm)
	return func(c *gin.Context) {
		if !limiter.get(c.ClientIP()).Allow() {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limited",
				"message": "Too many requests, please slow down",
			})
			return
		}
		c.Next()
	}
}
