import { RemovalPolicy } from 'aws-cdk-lib'
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import envVars from '../formsg-env-vars'

export class FormsgS3Buckets extends Construct {
  readonly s3Attachment: Bucket
  readonly s3PaymentProof: Bucket
  readonly s3Image: Bucket
  readonly s3Logo: Bucket
  readonly s3StaticAssets: Bucket
  readonly s3VirusScannerQuarantine: Bucket
  readonly s3VirusScannerClean: Bucket
  constructor(scope: Construct, s3Suffix: string) {
    super(scope, `s3-${s3Suffix}`)

    this.s3Attachment = new Bucket(this, `attachment`, {
      bucketName: envVars.ATTACHMENT_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3PaymentProof = new Bucket(this, `payment-proof`, {
      bucketName: envVars.PAYMENT_PROOF_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3Image = new Bucket(this, `image`, {
      bucketName: envVars.IMAGE_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
    })

    this.s3Logo = new Bucket(this, `logo`, {
      bucketName: envVars.LOGO_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
    })

    this.s3StaticAssets = new Bucket(this, `static-assets`, {
      bucketName: envVars.STATIC_ASSETS_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3VirusScannerQuarantine = new Bucket(this, `virus-scanner-quarantine`, {
      bucketName: envVars.VIRUS_SCANNER_QUARANTINE_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

    this.s3VirusScannerClean = new Bucket(this, `virus-scanner-clean`, {
      bucketName: envVars.VIRUS_SCANNER_CLEAN_S3_BUCKET,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
    })

  }

}
