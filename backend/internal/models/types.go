package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// JSONB is a map persisted as a PostgreSQL jsonb column. Used for Board.BoardState.
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONB) Scan(src interface{}) error {
	if src == nil {
		*j = JSONB{}
		return nil
	}
	var b []byte
	switch v := src.(type) {
	case []byte:
		b = v
	case string:
		b = []byte(v)
	default:
		return errors.New("models: unsupported type for JSONB scan")
	}
	if len(b) == 0 {
		*j = JSONB{}
		return nil
	}
	return json.Unmarshal(b, j)
}

// StringArray maps to a PostgreSQL text[] column. Used for Board.Tags.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if len(a) == 0 {
		return "{}", nil
	}
	escaped := make([]string, len(a))
	for i, s := range a {
		s = strings.ReplaceAll(s, `\`, `\\`)
		s = strings.ReplaceAll(s, `"`, `\"`)
		escaped[i] = `"` + s + `"`
	}
	return "{" + strings.Join(escaped, ",") + "}", nil
}

func (a *StringArray) Scan(src interface{}) error {
	if src == nil {
		*a = StringArray{}
		return nil
	}
	var s string
	switch v := src.(type) {
	case []byte:
		s = string(v)
	case string:
		s = v
	default:
		return fmt.Errorf("models: unsupported type for StringArray scan: %T", src)
	}
	s = strings.TrimSpace(s)
	if s == "{}" || s == "" {
		*a = StringArray{}
		return nil
	}
	s = strings.TrimPrefix(s, "{")
	s = strings.TrimSuffix(s, "}")
	parts := strings.Split(s, ",")
	out := make(StringArray, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, `"`)
		p = strings.ReplaceAll(p, `\"`, `"`)
		p = strings.ReplaceAll(p, `\\`, `\`)
		if p != "" {
			out = append(out, p)
		}
	}
	*a = out
	return nil
}
