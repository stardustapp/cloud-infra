FROM centos:7
RUN yum clean expire-cache && \
    yum update -y && \
    yum install -y epel-release && \
    yum install -y nagios nagios-selinux \
      nagios-plugins-nrpe nagios-plugins-http nagios-plugins-ping \
      nagios-plugins-ssh nagios-plugins-tcp nagios-plugins-dns \
      nagios-plugins-dig \
      perl-LWP-Protocol-https perl-Crypt-SSLeay perl-libwww-perl && \
    yum clean all
RUN sed -Ei.bak "/cgi_base_url/s#='.+'#='/cgi-bin'#" /usr/share/nagios/html/config.inc.php

