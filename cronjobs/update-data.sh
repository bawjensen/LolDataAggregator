#!/bin/bash
source /home/bryanjensen/.bashrc
PATH=$PATH:/usr/local/bin
(node compile-players.js && node compile-matches.js && node compile-final.js && node compile-database.js) > update.log
