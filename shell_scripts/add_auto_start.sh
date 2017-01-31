#!/usr/bin/env bash
#/*/---------------------------------------------------------/*/
#/*/ Craydent LLC proxy-v1.2.2                              /*/
#/*/ Copyright 2011 (http://craydent.com/about)              /*/
#/*/ Dual licensed under the MIT or GPL Version 2 licenses.  /*/
#/*/ (http://craydent.com/license)                           /*/
#/*/---------------------------------------------------------/*/
#/*/---------------------------------------------------------/*/
if [ -n "$(which systemctl)" ]; then
    if [ ! -f "/etc/systemd/system/cproxy.service" ]; then
        cp $1/cproxy.service /etc/systemd/system/cproxy.service;
        systemctl enable nodeserver.service;
        systemctl status nodeserver.service;
    else
        echo "Autostart is already enable.";
    fi

elif [ -n "$(which chkconfig)" ]; then
    if [ ! -f "/etc/init.d/cproxy" ]; then
        cp $1/cproxy /etc/init.d/cproxy;
        chmod a+x /etc/init.d/cproxy;
        chkconfig --add cproxy;
    else
        echo "Autostart is already enable.";
    fi
elif [ -n "$(which update-rc.d)" ]; then
    if [ ! -f "/etc/init.d/cproxy" ]; then
        cp $1/cproxy /etc/init.d/cproxy;
        chmod a+x /etc/init.d/cproxy;
        update-rc.d cproxy defaults;
    else
        echo "Autostart is already enable.";
    fi
fi

echo "Added cproxy to boot.";

exit 0