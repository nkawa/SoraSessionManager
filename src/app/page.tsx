"use client";
import React, { useEffect, useState } from "react";
import { Container, Row, Col,Table,  Button } from "react-bootstrap";
import SessionList from '../components/SessionList';


import TopNavi from "../components/TopNavi";

export default function Home() {


    return (
    <div>
      <TopNavi />
      <div>
        <div>
          <Container fluid="md" > 
          <h3>Metawork Sora SFU Manager</h3>
            <h4>SORA SFU セッション情報</h4>
              <SessionList />

          </Container>
        </div>
      </div>
    </div>
    );
    
}
