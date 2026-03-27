// GoClaw WebChat Proxy Server — Go (gorilla/websocket)
//
// Lightweight WebSocket proxy that sits between the chat widget and GoClaw Gateway.
// The proxy injects the auth token server-side so it never reaches the browser.
//
// Usage:
//
//	cp .env.example .env   # fill in GOCLAW_URL and GOCLAW_TOKEN
//	go run main.go
//
// Environment variables:
//
//	GOCLAW_URL       — Gateway WebSocket URL (required, e.g. "ws://localhost:9090/ws")
//	GOCLAW_TOKEN     — Gateway auth token (required, kept server-side)
//	PORT             — Proxy listen port (default: 3100)
//	ALLOWED_ORIGINS  — Comma-separated origin allowlist (empty = allow all)
//	PROXY_API_KEY    — Optional API key for proxy authentication
//	DEFAULT_AGENT_ID — Default agent ID injected into chat.send if client omits it
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// ── Config ──────────────────────────────────────────────────────────────────

var (
	goclawURL      string
	goclawToken    string
	port           string
	allowedOrigins []string
	proxyAPIKey    string
	defaultAgentID string
)

var activeConnections int64

var upgrader = websocket.Upgrader{
	ReadBufferSize:  512 * 1024,
	WriteBufferSize: 512 * 1024,
	CheckOrigin:     checkOrigin,
}

func loadConfig() {
	_ = godotenv.Load() // load .env if present, ignore error

	goclawURL = os.Getenv("GOCLAW_URL")
	if goclawURL == "" {
		log.Fatal("GOCLAW_URL environment variable is required")
	}

	goclawToken = os.Getenv("GOCLAW_TOKEN")
	if goclawToken == "" {
		log.Println("WARNING: GOCLAW_TOKEN not set — proxy will connect without authentication")
	}

	port = os.Getenv("PORT")
	if port == "" {
		port = "3100"
	}

	if origins := os.Getenv("ALLOWED_ORIGINS"); origins != "" {
		for _, o := range strings.Split(origins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}

	proxyAPIKey = os.Getenv("PROXY_API_KEY")
	defaultAgentID = os.Getenv("DEFAULT_AGENT_ID")
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func checkOrigin(r *http.Request) bool {
	if len(allowedOrigins) == 0 {
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false // reject missing origin when allowlist is active
	}
	for _, allowed := range allowedOrigins {
		if allowed == "*" || allowed == origin {
			return true
		}
	}
	return false
}

func checkAPIKey(r *http.Request) bool {
	if proxyAPIKey == "" {
		return true
	}
	key := r.URL.Query().Get("apiKey")
	if key == "" {
		key = r.Header.Get("X-API-Key")
	}
	return key == proxyAPIKey
}

// interceptFrame injects token into connect frames and default agentId into chat.send.
func interceptFrame(raw []byte) []byte {
	var frame map[string]interface{}
	if err := json.Unmarshal(raw, &frame); err != nil {
		return raw
	}

	if frame["type"] != "req" {
		return raw
	}

	modified := false

	// Inject gateway token into connect frame
	if frame["method"] == "connect" && goclawToken != "" {
		params, _ := frame["params"].(map[string]interface{})
		if params == nil {
			params = make(map[string]interface{})
		}
		params["token"] = goclawToken
		frame["params"] = params
		modified = true
	}

	// Inject default agentId into chat.send if not set by client
	if frame["method"] == "chat.send" && defaultAgentID != "" {
		params, _ := frame["params"].(map[string]interface{})
		if params == nil {
			params = make(map[string]interface{})
		}
		if _, exists := params["agentId"]; !exists {
			params["agentId"] = defaultAgentID
			frame["params"] = params
			modified = true
		}
	}

	if !modified {
		return raw
	}
	out, err := json.Marshal(frame)
	if err != nil {
		return raw
	}
	return out
}

// sanitizeUpstreamFrame strips token fields from upstream responses.
func sanitizeUpstreamFrame(raw []byte) []byte {
	var frame map[string]interface{}
	if err := json.Unmarshal(raw, &frame); err != nil {
		return raw
	}
	if frame["type"] == "res" {
		if payload, ok := frame["payload"].(map[string]interface{}); ok {
			if _, hasToken := payload["token"]; hasToken {
				delete(payload, "token")
				out, err := json.Marshal(frame)
				if err != nil {
					return raw
				}
				return out
			}
		}
	}
	return raw
}

// ── WebSocket proxy handler ────────────────────────────────────────────────

func handleWS(w http.ResponseWriter, r *http.Request) {
	if !checkAPIKey(r) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	clientConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[proxy] upgrade failed: %v", err)
		return
	}

	count := atomic.AddInt64(&activeConnections, 1)
	log.Printf("[proxy] client connected (active=%d)", count)

	// Connect to upstream GoClaw Gateway
	upstreamConn, _, err := websocket.DefaultDialer.Dial(goclawURL, nil)
	if err != nil {
		log.Printf("[proxy] upstream connection failed: %v", err)
		clientConn.Close()
		atomic.AddInt64(&activeConnections, -1)
		return
	}
	log.Println("[proxy] upstream connected")

	// Relay upstream -> client
	go func() {
		defer clientConn.Close()
		for {
			msgType, data, err := upstreamConn.ReadMessage()
			if err != nil {
				break
			}
			if msgType == websocket.TextMessage {
				data = sanitizeUpstreamFrame(data)
			}
			if err := clientConn.WriteMessage(msgType, data); err != nil {
				break
			}
		}
	}()

	// Relay client -> upstream (main goroutine for this connection)
	defer func() {
		upstreamConn.Close()
		clientConn.Close()
		remaining := atomic.AddInt64(&activeConnections, -1)
		log.Printf("[proxy] client disconnected (active=%d)", remaining)
	}()

	for {
		msgType, data, err := clientConn.ReadMessage()
		if err != nil {
			break
		}
		if msgType == websocket.TextMessage {
			data = interceptFrame(data)
		}
		if err := upstreamConn.WriteMessage(msgType, data); err != nil {
			break
		}
	}
}

// ── Health check ────────────────────────────────────────────────────────────

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","connections":%d}`, atomic.LoadInt64(&activeConnections))
}

// ── Main ────────────────────────────────────────────────────────────────────

func main() {
	loadConfig()

	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/health", handleHealth)

	log.Printf("[proxy] listening on :%s", port)
	log.Printf("[proxy] upstream: %s", goclawURL)
	if goclawToken != "" {
		log.Println("[proxy] auth token: configured")
	} else {
		log.Println("[proxy] auth token: NOT SET")
	}
	if proxyAPIKey != "" {
		log.Println("[proxy] API key: required")
	} else {
		log.Println("[proxy] API key: disabled")
	}
	if len(allowedOrigins) > 0 {
		log.Printf("[proxy] allowed origins: %s", strings.Join(allowedOrigins, ", "))
	} else {
		log.Println("[proxy] allowed origins: * (all)")
	}

	log.Fatal(http.ListenAndServe(":"+port, nil))
}
