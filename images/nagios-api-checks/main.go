package main

import (
	"fmt"
	"log"
	"net"

	"github.com/aperum/nrpe"
)

var statusMap = map[string]nrpe.CommandStatus{
	"ok":       nrpe.StatusOK,
	"warning":  nrpe.StatusWarning,
	"critical": nrpe.StatusCritical,
	"unknown":  nrpe.StatusUnknown,
}

func nrpeHandler(c nrpe.Command) (*nrpe.CommandResult, error) {
	status := "unknown"
	text := fmt.Sprintf("Check '%v' not registered", c.Name)
	switch c.Name {

	case "check_plex":
		status, text = checkPlex(c.Args[1])
	}

	return &nrpe.CommandResult{
		StatusLine: text,
		StatusCode: statusMap[status],
	}, nil
}

func main() {
	ln, err := net.Listen("tcp", ":5667")
	if err != nil {
		log.Fatalln(err)
	}
	log.Println("Listening on :5667 for NRPE")

	for {
		conn, err := ln.Accept()
		if err != nil {
			log.Println(err)
			continue
		}

		defer conn.Close()
		go nrpe.ServeOne(conn, nrpeHandler, true, 0)
	}
}
