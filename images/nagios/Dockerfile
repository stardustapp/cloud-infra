FROM centos:7

# install nagios from pkg manager
RUN yum clean expire-cache \
 && yum install -y epel-release \
 && yum install -y \
      nagios nagios-selinux nagios-plugins-all nagios-plugins-nrpe \
      perl-LWP-Protocol-https perl-Crypt-SSLeay perl-libwww-perl \
      python-requests \
      vim \
 && yum clean all

# install pinned kubectl release directly
RUN curl -LO \
    https://storage.googleapis.com/kubernetes-release/release/v1.18.2/bin/linux/amd64/kubectl \
 && chmod +x ./kubectl \
 && mv ./kubectl /usr/local/bin/kubectl \
 && kubectl version --client

# patch baseurl for direct hosting
RUN sed -Ei.bak "/cgi_base_url/s#='.+'#='/cgi-bin'#" \
      /usr/share/nagios/html/config.inc.php
