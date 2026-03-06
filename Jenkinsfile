pipeline {
    agent any

    environment {
        ACR_NAME         = 'buzztipsacr'
        ACR_LOGIN_SERVER = 'buzztipsacr.azurecr.io'
        AKS_CLUSTER      = 'buzztips-aks'
        AKS_RESOURCE_GROUP = 'buzztips-rg'
        IMAGE_TAG        = "${BUILD_NUMBER}-${GIT_COMMIT[0..7]}"
    }

    stages {

        stage('🔍 Checkout') {
            steps {
                checkout scm
                echo "Building branch: ${env.BRANCH_NAME} | Commit: ${env.GIT_COMMIT[0..7]}"
            }
        }

        stage('🧪 Test') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                            sh 'npm test'
                        }
                    }
                    post {
                        always {
                            junit 'backend/test-results/**/*.xml'
                        }
                    }
                }
                stage('Frontend Lint') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                            sh 'npm run lint'
                        }
                    }
                }
            }
        }

        stage('🐳 Build Docker Images') {
            parallel {
                stage('Build Frontend') {
                    steps {
                        sh """
                            docker build \
                                -t ${ACR_LOGIN_SERVER}/buzztips-frontend:${IMAGE_TAG} \
                                -t ${ACR_LOGIN_SERVER}/buzztips-frontend:latest \
                                ./frontend
                        """
                    }
                }
                stage('Build Backend') {
                    steps {
                        sh """
                            docker build \
                                -t ${ACR_LOGIN_SERVER}/buzztips-api:${IMAGE_TAG} \
                                -t ${ACR_LOGIN_SERVER}/buzztips-api:latest \
                                ./backend
                        """
                    }
                }
            }
        }

        stage('🔐 Login to Azure ACR') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'azure-acr-credentials',
                    usernameVariable: 'ACR_USER',
                    passwordVariable: 'ACR_PASS'
                )]) {
                    sh "docker login ${ACR_LOGIN_SERVER} -u ${ACR_USER} -p ${ACR_PASS}"
                }
            }
        }

        stage('📦 Push to ACR') {
            steps {
                sh "docker push ${ACR_LOGIN_SERVER}/buzztips-frontend:${IMAGE_TAG}"
                sh "docker push ${ACR_LOGIN_SERVER}/buzztips-frontend:latest"
                sh "docker push ${ACR_LOGIN_SERVER}/buzztips-api:${IMAGE_TAG}"
                sh "docker push ${ACR_LOGIN_SERVER}/buzztips-api:latest"
            }
        }

        stage('🚀 Deploy to AKS') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([azureServicePrincipal('azure-service-principal')]) {
                    sh """
                        az login --service-principal \
                            -u ${AZURE_CLIENT_ID} \
                            -p ${AZURE_CLIENT_SECRET} \
                            --tenant ${AZURE_TENANT_ID}

                        az aks get-credentials \
                            --resource-group ${AKS_RESOURCE_GROUP} \
                            --name ${AKS_CLUSTER} \
                            --overwrite-existing

                        # Update image tags in deployment
                        kubectl set image deployment/buzztips-frontend \
                            frontend=${ACR_LOGIN_SERVER}/buzztips-frontend:${IMAGE_TAG} \
                            -n buzztips

                        kubectl set image deployment/buzztips-api \
                            api=${ACR_LOGIN_SERVER}/buzztips-api:${IMAGE_TAG} \
                            -n buzztips

                        # Wait for rollout
                        kubectl rollout status deployment/buzztips-frontend -n buzztips --timeout=5m
                        kubectl rollout status deployment/buzztips-api -n buzztips --timeout=5m

                        echo "✅ Deployed BuzzTips ${IMAGE_TAG} to AKS"
                    """
                }
            }
        }

        stage('🌍 Smoke Test') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    sleep 15
                    curl -sf https://buzztips.com/health || (echo "❌ Health check failed!" && exit 1)
                    echo "✅ BuzzTips is live at https://buzztips.com"
                """
            }
        }
    }

    post {
        success {
            echo "🎉 Pipeline SUCCEEDED - BuzzTips ${IMAGE_TAG} deployed!"
            // slackSend channel: '#deployments', message: "✅ BuzzTips ${IMAGE_TAG} deployed successfully!"
        }
        failure {
            echo "❌ Pipeline FAILED - rolling back..."
            sh "kubectl rollout undo deployment/buzztips-frontend -n buzztips || true"
            sh "kubectl rollout undo deployment/buzztips-api -n buzztips || true"
            // slackSend channel: '#deployments', message: "❌ BuzzTips deployment failed! Rolling back."
        }
        always {
            sh "docker logout ${ACR_LOGIN_SERVER} || true"
            cleanWs()
        }
    }
}
