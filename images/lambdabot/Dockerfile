FROM centos:8
MAINTAINER ricky@elrod.me

# Obtain haskell and core deps
RUN yum clean all \
 && yum -y install drpm \
 && curl -o /etc/yum.repos.d/ghc.repo \
      https://copr.fedorainfracloud.org/coprs/petersen/ghc-8.6.1/repo/epel-7/petersen-ghc-8.6.1-epel-7.repo \
 && sed -i s/gpgcheck=1/gpgcheck=0/ /etc/yum.repos.d/ghc.repo \
 && yum -y install cabal-install ghc pcre-devel zlib-devel git

# Build the whole lambdabot ecosystem
ENV PATH="${HOME}/.cabal/bin:${PATH}"
RUN cabal update \
 && cabal install happy alex dependent-sum-0.4 \
 && cabal install haskell-src-exts-simple \
 && git clone git://github.com/relrod/djinn $HOME/djinn \
 && cabal install $HOME/djinn/djinn.cabal \
 && rm -rf $HOME/djinn \
 && cabal install --constraint 'transformers installed' lambdabot \
 && export PATH="${HOME}/.cabal/bin:${PATH}" \
 && hoogle generate \
 && hoogle data \
 && cabal install lens

# Facade mueval-core to install a higher timeout
# (lambdabot doesn't cope well on spinning or network disk)
RUN mv "${HOME}/.cabal/bin/mueval-core"{,-real} \
 && { echo '#!/bin/sh'; \
      echo 'mueval-core-real -t ${MUEVAL_TIMEOUT:-15} "$@"'; \
 }> "${HOME}/.cabal/bin/mueval-core" \
 && chmod +x "${HOME}/.cabal/bin/mueval-core"

ENTRYPOINT ["${HOME}/.cabal/bin/lambdabot"]
