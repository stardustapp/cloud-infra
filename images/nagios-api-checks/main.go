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
		status, text = checkPlex(c.Args[0])
	}

	log.Printf("Check '%v %v' resulted in '%v %v'", c.Name, c.Args, status, text)
	return &nrpe.CommandResult{
		StatusLine: text,
		StatusCode: statusMap[status],
	}, nil
}

func connectionHandler(conn net.Conn) {
	nrpe.ServeOne(conn, nrpeHandler, false, 0)
	log.Println("Connection closed.")
	conn.Close()
}

func main() {
	ln, err := net.Listen("tcp", ":5666")
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
		log.Println("Accepted connection from", conn.RemoteAddr().String())
		go connectionHandler(conn)
	}
}
