package main

import (
	"fmt"
	"os"

	"github.com/jrudio/go-plex-client"
)

func checkPlex(requestedServer string) (string, string) {
	plexConnection, err := plex.New("", os.Getenv("PLEX_AUTHTOKEN"))
	if err != nil {
		return "warning", "Connecting to Plex API failed: " + err.Error()
	}

	servers, err := plexConnection.GetServers()
	if err != nil {
		return "warning", "Listing servers failed: " + err.Error()
	}
	for _, server := range servers {
		if server.Name == requestedServer {
			plexConnection.URL = server.Connection[len(server.Connection)-1].URI
		}
	}
	if plexConnection.URL == "" {
		return "critical", fmt.Sprintf("Plex server '%v' not found (saw %v servers)", requestedServer, len(servers))
	}

	if _, err := plexConnection.Test(); err != nil {
		return "critical", "Server test failed: " + err.Error()
	}

	sessions, err := plexConnection.GetSessions()
  if err != nil {
		return "critical", "Communication failed: " + err.Error()
	}

	var paused int
	var playing int
	for _, session := range sessions.MediaContainer.Metadata {
		switch session.Player.State {
		case "playing":
			playing++
		case "paused":
			paused++
		}
	}

	if sessions.MediaContainer.Size < 1 {
		return "ok", "OK: No active streaming sessions"
	} else {
		return "ok", fmt.Sprintf("OK: %d streaming sessions (%d playing, %d paused)", sessions.MediaContainer.Size, playing, paused)
	}
}

// func main() {
//   status, text := checkPlex(os.Getenv("PLEX_SERVER"))
//   log.Println(status, text)
// }
