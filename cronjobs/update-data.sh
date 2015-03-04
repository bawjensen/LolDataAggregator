#!/bin/bash
if [ -f /home/bryanjensen/.bashrc ]; then
    source /home/bryanjensen/.bashrc
fi
PATH=$PATH:/usr/local/bin
(node compile-players.js && node compile-matches.js && node compile-final.js && node compile-database.js) > update.log
