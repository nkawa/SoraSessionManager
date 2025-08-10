"use client"

import { Container, Nav, Navbar } from "react-bootstrap";
import Link from 'next/link';
import packageInfo from '../../package.json' assert { type: "json" };

export default function TopNavi() {
  const ver = packageInfo.version

  return (
    <Navbar  bg="black" expand="md" data-bs-theme="dark">
      <Container>
        <Navbar.Brand as={Link} href="/">
        Metawork SFU Sora Manager {ver}  
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} href="/conn">  Connections </Nav.Link>
          </Nav>
          <Nav className="me-auto">
            <Nav.Link as={Link} href="/list">  Clients </Nav.Link>
          </Nav>
          <Nav>
            <Nav.Link as={Link} href="https://ucl.nuee.nagoya-u.ac.jp">
              UCLab HP{" "}
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};