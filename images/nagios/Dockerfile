FROM centos:7
RUN yum clean expire-cache && \
    yum install -y epel-release && \
    yum install -y nagios nagios-selinux nagios-plugins-all \
      perl-LWP-Protocol-https perl-Crypt-SSLeay perl-libwww-perl && \
    yum clean all
RUN sed -Ei.bak "/cgi_base_url/s#='.+'#='/cgi-bin'#" /usr/share/nagios/html/config.inc.php

