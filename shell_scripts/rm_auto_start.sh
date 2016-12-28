#!/usr/bin/env bash
#/*/---------------------------------------------------------/*/
#/*/ Craydent LLC proxy-v1.2.0                              /*/
#/*/ Copyright 2011 (http://craydent.com/about)              /*/
#/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
#/*/ (http://craydent.com/license)                           /*/
#/*/---------------------------------------------------------/*/
#/*/---------------------------------------------------------/*/
if [ -n "$(which systemctl)" ]; then
    if [ -f "/etc/systemd/system/cproxy.service" ]; then
        rm /etc/systemd/system/cproxy.service;
        systemctl disable nodeserver.service
    else
        echo "Auto start is not enabled";
    fi

elif [ -n "$(which chkconfig)" ]; then
    if [ -f "/etc/init.d/cproxy" ]; then
        rm /etc/init.d/cproxy;
        chkconfig --del cproxy
    else
        echo "Auto start is not enabled";
    fi
elif [ -n "$(which update-rc.d)" ]; then
    if [ -f "/etc/init.d/cproxy" ]; then
        rm /etc/init.d/cproxy;
        sudo update-rc.d cproxy remove
    else
        echo "Auto start is not enabled";
    fi
fi

echo "Removing cproxy from boot.";

exit 0